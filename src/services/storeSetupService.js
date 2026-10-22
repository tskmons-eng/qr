import { collection, doc, getCountFromServer, getDoc, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { normalizeStoreName } from '../lib/storeIdentity'

// 「はじめの準備」に使う店の状態（2026-10-22 店舗登録）。件数だけを数える（明細は読まない）。
export async function loadStoreSetupState(storeId) {
  const [storeSnap, staffCount, productCount] = await Promise.all([
    getDoc(doc(db, 'stores', storeId)),
    getCountFromServer(query(collection(db, 'staffMembers'), where('storeId', '==', storeId))),
    getCountFromServer(query(collection(db, 'products'), where('storeId', '==', storeId))),
  ])
  const store = storeSnap.exists() ? storeSnap.data() : {}
  return {
    storeName: normalizeStoreName(store.storeName),
    setupGuideRequired: store.setupGuideRequired === true,
    setupGuideClosed: Boolean(store.setupGuideClosedAt),
    staffCount: staffCount.data().count,
    productCount: productCount.data().count,
  }
}

export function closeStoreSetupGuide(storeId) {
  return updateDoc(doc(db, 'stores', storeId), { setupGuideClosedAt: serverTimestamp() })
}
