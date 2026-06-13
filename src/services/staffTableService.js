import { addDoc, collection, doc, getDoc, getDocs, increment, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { hasStaffPermission } from '../lib/staffPermissions'
import { filterVisibleOrderItems, sortOrderItemsByOrderedAt } from '../lib/staffTableDetail'
import { buildEmptyTablePendingAggregateFields } from '../lib/tablePending'

function mapDocs(snapshot) {
  return snapshot.docs.map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() }))
}

export function subscribeStaffTable(tableId, onNext) {
  return onSnapshot(doc(db, 'tables', tableId), snap => {
    onNext(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  })
}

export function subscribeStaffTableOrderItems(orderId, onNext) {
  const orderItemsQuery = query(collection(db, 'orderItems'), where('orderId', '==', orderId))
  return onSnapshot(orderItemsQuery, snap => {
    onNext(sortOrderItemsByOrderedAt(filterVisibleOrderItems(mapDocs(snap))))
  })
}

export function markOrderItemServed({ tableId, itemId }) {
  return Promise.all([
    updateDoc(doc(db, 'orderItems', itemId), { itemStatus: 'served', updatedAt: serverTimestamp() }),
    updateDoc(doc(db, 'tables', tableId), { pendingCount: increment(-1), updatedAt: serverTimestamp() }),
  ])
}

export function markOrderItemOrdered({ tableId, itemId }) {
  return Promise.all([
    updateDoc(doc(db, 'orderItems', itemId), { itemStatus: 'ordered', updatedAt: serverTimestamp() }),
    updateDoc(doc(db, 'tables', tableId), { pendingCount: increment(1), updatedAt: serverTimestamp() }),
  ])
}

export async function cancelOrderItem({ table, tableId, item, passcode, activeStaff }) {
  const canBypassPasscode = hasStaffPermission(activeStaff, 'manageMenu', { useKitchen: true, closeRegister: false, manageMenu: false })
  if (!canBypassPasscode) {
    const storeSnap = await getDoc(doc(db, 'stores', table.storeId))
    if (storeSnap.data()?.adminPasscode !== passcode) {
      return { ok: false, reason: 'invalid-passcode' }
    }
  }

  const actor = auth.currentUser
  await updateDoc(doc(db, 'orderItems', item.id), {
    itemStatus: 'cancelled',
    updatedAt: serverTimestamp(),
  })
  if (item.itemStatus === 'ordered') {
    await updateDoc(doc(db, 'tables', tableId), { pendingCount: increment(-1), updatedAt: serverTimestamp() })
  }
  await addDoc(collection(db, 'staffActions'), {
    storeId: table.storeId,
    actionType: 'cancel_item',
    targetType: 'orderItem',
    targetId: item.id,
    actorType: 'staff',
    actorStaffId: activeStaff?.id ?? null,
    actorStaffName: activeStaff?.name ?? null,
    actorUid: actor?.uid ?? null,
    note: `${item.productNameSnapshot} × ${item.quantity} をキャンセル`,
    createdAt: serverTimestamp(),
  })

  return { ok: true }
}

export async function seatGuestsAtTable({ table, tableId, seatCount, activeStaff }) {
  const now = serverTimestamp()
  const orderRef = await addDoc(collection(db, 'orders'), {
    storeId: table.storeId,
    tableId,
    guestCount: seatCount,
    status: 'open',
    openedAt: now,
    checkedOutAt: null,
    createdBy: 'staff',
    updatedAt: now,
  })
  await updateDoc(doc(db, 'tables', tableId), {
    status: 'occupied',
    guestCount: seatCount,
    currentOrderId: orderRef.id,
    startedAt: now,
    pendingCount: 0,
    ...buildEmptyTablePendingAggregateFields(),
    updatedAt: now,
  })
  await addDoc(collection(db, 'staffActions'), {
    storeId: table.storeId,
    actionType: 'seat_guests',
    targetType: 'table',
    targetId: tableId,
    actorType: 'staff',
    actorStaffId: activeStaff?.id ?? null,
    actorStaffName: activeStaff?.name ?? null,
    note: `${seatCount}名着席`,
    createdAt: now,
  })
}

export async function updateTableGuestCount({ table, tableId, guestCount, activeStaff }) {
  await updateDoc(doc(db, 'tables', tableId), { guestCount, updatedAt: serverTimestamp() })
  await addDoc(collection(db, 'staffActions'), {
    storeId: table.storeId,
    actionType: 'adjust_guests',
    targetType: 'table',
    targetId: tableId,
    actorType: 'staff',
    actorStaffId: activeStaff?.id ?? null,
    actorStaffName: activeStaff?.name ?? null,
    note: `人数変更 ${table.guestCount}名 → ${guestCount}名`,
    createdAt: serverTimestamp(),
  })
}

export async function loadVacantTables({ storeId, currentTableId }) {
  const snap = await getDocs(query(collection(db, 'tables'), where('storeId', '==', storeId), where('status', '==', 'vacant')))
  return snap.docs
    .map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() }))
    .filter(table => table.id !== currentTableId)
    .sort((a, b) => a.tableName.localeCompare(b.tableName, 'ja'))
}

export async function moveTableOrder({ sourceTable, sourceTableId, targetTable, activeStaff }) {
  const now = serverTimestamp()
  if (sourceTable.currentOrderId) {
    const itemSnap = await getDocs(query(
      collection(db, 'orderItems'),
      where('orderId', '==', sourceTable.currentOrderId)
    ))
    if (!itemSnap.empty) {
      const batch = writeBatch(db)
      itemSnap.docs.forEach(itemDoc => {
        batch.update(itemDoc.ref, {
          tableId: targetTable.id,
          updatedAt: now,
        })
      })
      await batch.commit()
    }
  }

  await updateDoc(doc(db, 'tables', sourceTableId), {
    status: 'vacant',
    currentOrderId: null,
    guestCount: 0,
    startedAt: null,
    pendingCount: 0,
    updatedAt: now,
  })
  await updateDoc(doc(db, 'tables', targetTable.id), {
    status: 'occupied',
    currentOrderId: sourceTable.currentOrderId,
    guestCount: sourceTable.guestCount,
    startedAt: sourceTable.startedAt ?? null,
    pendingCount: sourceTable.pendingCount ?? 0,
    updatedAt: now,
  })
  await addDoc(collection(db, 'staffActions'), {
    storeId: sourceTable.storeId,
    actionType: 'move_table',
    targetType: 'table',
    targetId: targetTable.id,
    actorType: 'staff',
    actorStaffId: activeStaff?.id ?? null,
    actorStaffName: activeStaff?.name ?? null,
    note: `${sourceTable.tableName} → ${targetTable.tableName} に移動`,
    createdAt: now,
  })
}
