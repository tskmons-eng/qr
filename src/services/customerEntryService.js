import { addDoc, collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { normalizeCustomerStoreConfig } from '../lib/customerEntry'
import { db } from '../lib/firebase'

export function subscribeCustomerTableByQrToken(qrToken, onNext, onError) {
  const tableQuery = query(collection(db, 'tables'), where('qrToken', '==', qrToken))
  return onSnapshot(tableQuery, snap => {
    if (snap.empty) {
      onNext(null)
      return
    }
    const tableDoc = snap.docs[0]
    onNext({ id: tableDoc.id, ...tableDoc.data() })
  }, onError)
}

export async function loadCustomerStoreConfig(storeId) {
  const snap = await getDoc(doc(db, 'storeConfig', storeId))
  return normalizeCustomerStoreConfig(snap.exists() ? snap.data() : {})
}

export async function createCustomerOrderSession({ guestCount, storeId, tableId }) {
  const openedAt = serverTimestamp()
  const orderRef = await addDoc(collection(db, 'orders'), {
    storeId,
    tableId,
    guestCount,
    status: 'open',
    openedAt,
    checkedOutAt: null,
    createdBy: 'customer',
    updatedAt: openedAt,
  })

  await updateDoc(doc(db, 'tables', tableId), {
    status: 'occupied',
    guestCount,
    currentOrderId: orderRef.id,
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return orderRef.id
}
