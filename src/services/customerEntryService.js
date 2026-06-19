import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore'
import { normalizeCustomerStoreConfig } from '../lib/customerEntry'
import { db } from '../lib/firebase'
import { startCustomerOrderSession } from './orderCommandService'

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

export function createCustomerOrderSession({ guestAutoAdd, guestCount, storeId, tableId }) {
  return startCustomerOrderSession({ guestAutoAdd, guestCount, storeId, tableId })
}
