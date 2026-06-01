import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'

export function subscribeCustomerOrderItems(orderId, onChange) {
  const q = query(collection(db, 'orderItems'), where('orderId', '==', orderId))
  return onSnapshot(q, snap => {
    const items = snap.docs
      .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
      .filter(item => item.itemStatus !== 'cancelled')
      .sort((a, b) => (a.orderedAt?.seconds ?? 0) - (b.orderedAt?.seconds ?? 0))

    onChange(items)
  })
}
