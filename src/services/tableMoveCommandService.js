import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { ORDER_COMMAND_VERSION } from '../lib/orderCommands'
import {
  buildMoveTableStaffActionPayload,
  commandError,
} from '../lib/orderCommandPayloads'
import { withOrderCommandFailureLog } from './orderCommandFailureService'
import { callOrderCommandFunction, shouldUseOrderCommandFunctions } from './orderFunctionCommandService'

function normalizeItemStatus(item) {
  return item?.itemStatus ?? 'ordered'
}

async function loadOrderItemRefs(orderId) {
  const itemSnap = await getDocs(query(
    collection(db, 'orderItems'),
    where('orderId', '==', orderId)
  ))
  return itemSnap.docs.map(itemDoc => itemDoc.ref)
}

export async function moveTableOrderCommand({ sourceTable, sourceTableId, targetTable, activeStaff }) {
  return withOrderCommandFailureLog({
    commandType: 'move_table_order',
    actorType: 'staff',
    storeId: sourceTable?.storeId ?? targetTable?.storeId,
    tableId: sourceTableId,
    targetTableId: targetTable?.id,
    orderId: sourceTable?.currentOrderId,
  }, async () => {
    if (shouldUseOrderCommandFunctions()) {
      return callOrderCommandFunction('moveTableOrderCommand', { sourceTableId, targetTable, activeStaff })
    }

    const orderId = sourceTable?.currentOrderId
    if (!orderId) throw commandError('order-not-found', 'No active order is linked to the source table.')

    const itemRefs = await loadOrderItemRefs(orderId)
    const sourceTableRef = doc(db, 'tables', sourceTableId)
    const targetTableRef = doc(db, 'tables', targetTable.id)
    const orderRef = doc(db, 'orders', orderId)
    const staffActionRef = doc(collection(db, 'staffActions'))
    const now = serverTimestamp()

    return runTransaction(db, async transaction => {
      const sourceSnap = await transaction.get(sourceTableRef)
      const targetSnap = await transaction.get(targetTableRef)
      const orderSnap = await transaction.get(orderRef)
      const itemRows = []
      for (const itemRef of itemRefs) {
        const itemSnap = await transaction.get(itemRef)
        if (itemSnap.exists()) itemRows.push({ itemRef, item: itemSnap.data() })
      }

      if (!sourceSnap.exists()) throw commandError('source-table-not-found', 'Source table was not found.')
      if (!targetSnap.exists()) throw commandError('target-table-not-found', 'Target table was not found.')
      if (!orderSnap.exists()) throw commandError('order-not-found', 'Order was not found.')

      const latestSource = { id: sourceSnap.id, ...sourceSnap.data() }
      const latestTarget = { id: targetSnap.id, ...targetSnap.data() }
      const order = orderSnap.data()
      if (latestSource.storeId !== sourceTable.storeId || latestTarget.storeId !== sourceTable.storeId) {
        throw commandError('table-scope-mismatch', 'Tables do not match this store.')
      }
      if (latestSource.currentOrderId !== orderId) {
        throw commandError('source-order-mismatch', 'Source table is no longer linked to this order.')
      }
      if (latestTarget.currentOrderId || (latestTarget.status && latestTarget.status !== 'vacant')) {
        throw commandError('target-table-not-vacant', 'Target table is not vacant.')
      }
      if (order.storeId !== sourceTable.storeId || order.tableId !== sourceTableId || order.status !== 'open') {
        throw commandError('order-scope-mismatch', 'Order does not match the source table.')
      }

      const movedItems = itemRows.filter(({ item }) => item.orderId === orderId)
      const pendingCount = movedItems.filter(({ item }) => normalizeItemStatus(item) === 'ordered').length

      movedItems.forEach(({ itemRef }) => {
        transaction.update(itemRef, {
          tableId: targetTable.id,
          updatedAt: now,
          orderCommandVersion: ORDER_COMMAND_VERSION,
        })
      })
      transaction.update(orderRef, {
        tableId: targetTable.id,
        updatedAt: now,
        orderCommandVersion: ORDER_COMMAND_VERSION,
      })
      transaction.update(sourceTableRef, {
        status: 'vacant',
        currentOrderId: null,
        guestCount: 0,
        startedAt: null,
        pendingCount: 0,
        updatedAt: now,
      })
      transaction.update(targetTableRef, {
        status: 'occupied',
        currentOrderId: orderId,
        guestCount: latestSource.guestCount ?? 0,
        startedAt: latestSource.startedAt ?? null,
        pendingCount,
        updatedAt: now,
      })
      transaction.set(staffActionRef, buildMoveTableStaffActionPayload({
        storeId: sourceTable.storeId,
        sourceTable: latestSource,
        targetTable: latestTarget,
        activeStaff,
        timestamp: now,
      }))
    })
  })
}
