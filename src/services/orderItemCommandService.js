import { collection, doc, increment, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { ORDER_COMMAND_VERSION } from '../lib/orderCommands'
import {
  buildCancelItemStaffActionPayload,
  commandError,
} from '../lib/orderCommandPayloads'
import { getOrderCommandErrorCode } from '../lib/orderCommandErrors'
import { withOrderCommandFailureLog } from './orderCommandFailureService'
import { callOrderCommandFunction, shouldUseOrderCommandFunctions } from './orderFunctionCommandService'

function normalizeItemStatus(item) {
  return item?.itemStatus ?? 'ordered'
}

function normalizeItemTargets(items) {
  return Array.isArray(items) ? items.filter(item => item?.id) : []
}

function assertTargetTableMatches(item, requestedTableId) {
  if (requestedTableId && item.tableId && item.tableId !== requestedTableId) {
    throw commandError('item-table-mismatch', 'Order item is not linked to this table.', {
      storeId: item.storeId,
      tableId: item.tableId ?? requestedTableId,
      orderId: item.orderId,
      itemId: item.id,
    })
  }
}

function addTableDelta(tableDeltas, tableId, delta) {
  if (!tableId || delta === 0) return
  tableDeltas.set(tableId, (tableDeltas.get(tableId) ?? 0) + delta)
}

async function updateItemsToServed({ targets }) {
  const now = serverTimestamp()

  return runTransaction(db, async transaction => {
    const itemRows = []
    for (const target of targets) {
      const itemRef = doc(db, 'orderItems', target.id)
      const itemSnap = await transaction.get(itemRef)
      if (!itemSnap.exists()) throw commandError('item-not-found', 'Order item was not found.')
      const item = { id: itemSnap.id, ...itemSnap.data() }
      assertTargetTableMatches(item, target.tableId)
      itemRows.push({ itemRef, item, tableId: target.tableId ?? item.tableId ?? null })
    }

    const tableDeltas = new Map()
    itemRows.forEach(({ itemRef, item, tableId }) => {
      if (normalizeItemStatus(item) !== 'ordered') return
      transaction.update(itemRef, {
        itemStatus: 'served',
        updatedAt: now,
        orderCommandVersion: ORDER_COMMAND_VERSION,
      })
      addTableDelta(tableDeltas, tableId, -1)
    })

    tableDeltas.forEach((delta, tableId) => {
      transaction.update(doc(db, 'tables', tableId), {
        pendingCount: increment(delta),
        updatedAt: now,
      })
    })

    return { ok: true, changed: itemRows.length }
  })
}

export function markOrderItemServedCommand({ tableId, itemId }) {
  return withOrderCommandFailureLog({
    commandType: 'mark_item_served',
    actorType: 'staff',
    tableId,
    itemId,
  }, () => (
    shouldUseOrderCommandFunctions()
      ? callOrderCommandFunction('markOrderItemServedCommand', { tableId, itemId })
      : updateItemsToServed({ targets: [{ id: itemId, tableId }] })
  ))
}

export function markOrderItemsServedCommand(items) {
  const targets = normalizeItemTargets(items)
  return withOrderCommandFailureLog({
    commandType: 'mark_items_served',
    actorType: 'staff',
    tableId: targets[0]?.tableId,
    itemId: targets[0]?.id,
  }, () => (
    shouldUseOrderCommandFunctions()
      ? callOrderCommandFunction('markOrderItemsServedCommand', { items: targets })
      : updateItemsToServed({ targets })
  ))
}

export async function markOrderItemOrderedCommand({ tableId, itemId }) {
  return withOrderCommandFailureLog({
    commandType: 'mark_item_ordered',
    actorType: 'staff',
    tableId,
    itemId,
  }, async () => {
    if (shouldUseOrderCommandFunctions()) {
      return callOrderCommandFunction('markOrderItemOrderedCommand', { tableId, itemId })
    }

    const itemRef = doc(db, 'orderItems', itemId)
    const now = serverTimestamp()

    return runTransaction(db, async transaction => {
      const itemSnap = await transaction.get(itemRef)
      if (!itemSnap.exists()) throw commandError('item-not-found', 'Order item was not found.')
      const item = { id: itemSnap.id, ...itemSnap.data() }
      assertTargetTableMatches(item, tableId)
      if (normalizeItemStatus(item) !== 'served') return { ok: true, changed: false }

      transaction.update(itemRef, {
        itemStatus: 'ordered',
        updatedAt: now,
        orderCommandVersion: ORDER_COMMAND_VERSION,
      })
      const resolvedTableId = tableId ?? item.tableId ?? null
      if (resolvedTableId) {
        transaction.update(doc(db, 'tables', resolvedTableId), {
          pendingCount: increment(1),
          updatedAt: now,
        })
      }
      return { ok: true, changed: true }
    })
  })
}

export async function cancelOrderItemCommand({
  itemId,
  tableId,
  tableName,
  source,
  activeStaff,
  actorUid,
  passcode,
}) {
  return withOrderCommandFailureLog({
    commandType: 'cancel_order_item',
    actorType: 'staff',
    tableId,
    itemId,
  }, async () => {
    if (shouldUseOrderCommandFunctions()) {
      return callOrderCommandFunction('cancelOrderItemCommand', {
        itemId,
        tableId,
        tableName,
        source,
        activeStaff,
        actorUid,
        ...(passcode ? { passcode } : {}),
      })
    }

    const itemRef = doc(db, 'orderItems', itemId)
    const staffActionRef = doc(collection(db, 'staffActions'))
    const now = serverTimestamp()

    return runTransaction(db, async transaction => {
      const itemSnap = await transaction.get(itemRef)
      if (!itemSnap.exists()) throw commandError('item-not-found', 'Order item was not found.')
      const item = { id: itemSnap.id, ...itemSnap.data() }
      assertTargetTableMatches(item, tableId)

      if (normalizeItemStatus(item) === 'cancelled') {
        return { ok: true, deduped: true }
      }

      const resolvedTableId = tableId ?? item.tableId ?? null
      transaction.update(itemRef, {
        itemStatus: 'cancelled',
        updatedAt: now,
        orderCommandVersion: ORDER_COMMAND_VERSION,
      })
      if (normalizeItemStatus(item) === 'ordered' && resolvedTableId) {
        transaction.update(doc(db, 'tables', resolvedTableId), {
          pendingCount: increment(-1),
          updatedAt: now,
        })
      }
      transaction.set(staffActionRef, buildCancelItemStaffActionPayload({
        storeId: item.storeId,
        itemId,
        item,
        tableName,
        source,
        activeStaff,
        actorUid,
        timestamp: now,
      }))

      return { ok: true, deduped: false }
    })
  })
}

// 席詳細と厨房で共通の取消。パスコードが違うときだけは例外にせず、画面で入力し直せるように返す。
export async function cancelOrderItemWithPasscode(params) {
  try {
    await cancelOrderItemCommand(params)
    return { ok: true }
  } catch (error) {
    if (getOrderCommandErrorCode(error) === 'invalid-cancel-passcode') {
      return { ok: false, reason: 'invalid-passcode' }
    }
    throw error
  }
}
