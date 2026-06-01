import { addDoc, collection, doc, increment, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

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
  await updateDoc(doc(db, 'orderItems', item.id), {
    itemStatus: 'served',
    updatedAt: serverTimestamp(),
  })

  if (item.tableId) {
    await updateDoc(doc(db, 'tables', item.tableId), {
      pendingCount: increment(-1),
      updatedAt: serverTimestamp(),
    })
  }
}

export async function markKitchenItemsServed(items) {
  await Promise.all(items.map(item => updateDoc(doc(db, 'orderItems', item.id), {
    itemStatus: 'served',
    updatedAt: serverTimestamp(),
  })))

  const tableId = items[0]?.tableId
  if (tableId) {
    await updateDoc(doc(db, 'tables', tableId), {
      pendingCount: increment(-items.length),
      updatedAt: serverTimestamp(),
    })
  }
}

export async function cancelKitchenItem({ item, table, activeStaff }) {
  const now = serverTimestamp()
  await updateDoc(doc(db, 'orderItems', item.id), {
    itemStatus: 'cancelled',
    updatedAt: now,
  })

  if (item.tableId) {
    await updateDoc(doc(db, 'tables', item.tableId), {
      pendingCount: increment(-1),
      updatedAt: now,
    })
  }

  const actor = auth.currentUser
  await addDoc(collection(db, 'staffActions'), {
    storeId: item.storeId,
    actionType: 'cancel_item',
    targetType: 'orderItem',
    targetId: item.id,
    actorType: 'staff',
    actorStaffId: activeStaff?.id ?? null,
    actorStaffName: activeStaff?.name ?? null,
    actorUid: actor?.uid ?? null,
    note: `${table?.tableName ?? ''} ${item.productNameSnapshot} x${item.quantity} を削除`,
    createdAt: now,
  })
}
