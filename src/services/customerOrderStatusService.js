import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { sortCustomerOrderItems } from '../lib/customerOrderStatus'

// 注文の品を読めるのは、店の人と「この端末はこの注文」と記録されたお客様だけ（2026-10-29 QR 第2章）。
export function subscribeCustomerOrderItems(orderId, onChange, onError) {
  const q = query(collection(db, 'orderItems'), where('orderId', '==', orderId))
  return onSnapshot(q, snap => {
    const items = sortCustomerOrderItems(
      snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })),
    )

    onChange(items)
  }, onError)
}
