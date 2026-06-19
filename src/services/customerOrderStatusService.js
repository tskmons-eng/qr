import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { sortCustomerOrderItems } from '../lib/customerOrderStatus'

export function subscribeCustomerOrderItems(orderId, onChange) {
  const q = query(collection(db, 'orderItems'), where('orderId', '==', orderId))
  return onSnapshot(q, snap => {
    const items = sortCustomerOrderItems(
      snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })),
    )

    onChange(items)
  })
}
