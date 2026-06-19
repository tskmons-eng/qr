import { collection, doc, increment, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { ORDER_COMMAND_VERSION } from '../lib/orderCommands'
import {
  buildCancelItemStaffActionPayload,
  commandError,
} from '../lib/orderCommandPayloads'

function normalizeItemStatus(item) {
  return item?.itemStatus ?? 'ordered'
}

function normalizeItemTargets(items) {
  return Array.isArray(items) ? items.filter(item => item?.id) : []
}

function assertTargetTableMatches(item, requestedTableId) {
  if (requestedTableId && item.tableId && item.tableId !== requestedTableId) {
    throw commandError('item-table-mismatch', 'Order item is not linked to this table.')
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
  return updateItemsToServed({ targets: [{ id: itemId, tableId }] })
}

export function markOrderItemsServedCommand(items) {
  return updateItemsToServed({ targets: normalizeItemTargets(items) })
}

export async function markOrderItemOrderedCommand({ tableId, itemId }) {
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
}

export async function cancelOrderItemCommand({
  itemId,
  tableId,
  tableName,
  source,
  activeStaff,
  actorUid,
}) {
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
}
