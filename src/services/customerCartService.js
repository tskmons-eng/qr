import { addDoc, collection, doc, increment, serverTimestamp, updateDoc } from 'firebase/firestore'
import { buildCustomerOrderItemPayload } from '../lib/customerCart'
import { db } from '../lib/firebase'

export async function submitCustomerCartOrder({ items, orderId, storeId, tableId }) {
  const now = serverTimestamp()
  await Promise.all(items.map(cartItem => (
    addDoc(collection(db, 'orderItems'), buildCustomerOrderItemPayload({
      cartItem,
      orderId,
      storeId,
      tableId,
      timestamp: now,
    }))
  )))

  await updateDoc(doc(db, 'tables', tableId), {
    pendingCount: increment(items.length),
    updatedAt: now,
  })
}
