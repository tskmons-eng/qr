import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { countPendingOrderItems } from '../lib/staffTableList'
import { db } from '../lib/firebase'

export function subscribeStaffTables(storeId, onChange) {
  const q = query(collection(db, 'tables'), where('storeId', '==', storeId))
  return onSnapshot(q, snap => {
    const tables = snap.docs
      .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
      .sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0))

    onChange(tables)
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
