import { addDoc, collection, doc, increment, serverTimestamp, updateDoc } from 'firebase/firestore'
import { buildCustomerOrderItemPayload } from '../lib/customerCart'
import { db } from '../lib/firebase'

async function syncTablePendingCount({ tableId, itemCount, timestamp }) {
  try {
    await updateDoc(doc(db, 'tables', tableId), {
      pendingCount: increment(itemCount),
      updatedAt: timestamp,
    })
  } catch (error) {
    console.warn('Customer order submitted, but table pending count sync failed.', error)
  }
}

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

  await syncTablePendingCount({ tableId, itemCount: items.length, timestamp: now })
}
