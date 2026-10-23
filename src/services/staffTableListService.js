import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { countPendingOrderItems } from '../lib/staffTableList'
import { db } from '../lib/firebase'
import { sortTables } from '../lib/tableOrder'

export function subscribeStaffTables(storeId, onChange) {
  const q = query(collection(db, 'tables'), where('storeId', '==', storeId))
  return onSnapshot(q, snap => {
    onChange(sortTables(snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))))
  })
}

export function subscribeStaffPendingCounts(storeId, onChange) {
  const q = query(
    collection(db, 'orderItems'),
    where('storeId', '==', storeId),
    where('itemStatus', '==', 'ordered')
  )

  return onSnapshot(q, snap => {
    onChange(countPendingOrderItems(snap.docs.map(docSnap => docSnap.data())))
  })
}
