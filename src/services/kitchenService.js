import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import {
  cancelOrderItemCommand,
  markOrderItemOrderedCommand,
  markOrderItemsServedCommand,
  markOrderItemServedCommand,
} from './orderItemCommandService'

function mapDocs(snapshot) {
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
}

export function subscribeKitchenTables(storeId, onNext) {
  const kitchenTablesQuery = query(collection(db, 'tables'), where('storeId', '==', storeId))
  return onSnapshot(kitchenTablesQuery, snap => onNext(mapDocs(snap)))
}

export function subscribePendingKitchenItems(storeId, onNext) {
  const pendingItemsQuery = query(
    collection(db, 'orderItems'),
    where('storeId', '==', storeId),
    where('itemStatus', '==', 'ordered')
  )
  return onSnapshot(pendingItemsQuery, snap => onNext(mapDocs(snap)))
}

export async function markKitchenItemServed(item) {
  return markOrderItemServedCommand({ tableId: item.tableId, itemId: item.id })
}

export async function markKitchenItemsServed(items) {
  return markOrderItemsServedCommand(items)
}

export async function markKitchenItemOrdered(item) {
  return markOrderItemOrderedCommand({ tableId: item.tableId, itemId: item.id })
}

export async function markKitchenItemsOrdered(items) {
  const results = await Promise.allSettled(items.map(item => markKitchenItemOrdered(item)))
  const rejected = results.find(result => result.status === 'rejected')
  if (rejected) throw rejected.reason
  return results.map(result => result.value)
}

export async function cancelKitchenItem({ item, table, activeStaff }) {
  return cancelOrderItemCommand({
    itemId: item.id,
    tableId: item.tableId,
    tableName: table?.tableName ?? '',
    source: 'kitchen',
    activeStaff,
    actorUid: auth.currentUser?.uid ?? null,
  })
}
