import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { normalizeStoreConfig } from '../lib/settingsConfig'

export async function loadStoreCode(storeId) {
  const snap = await getDoc(doc(db, 'stores', storeId))
  return snap.exists() ? (snap.data().storeCode ?? '') : ''
}

export async function loadStoreConfig(storeId) {
  const snap = await getDoc(doc(db, 'storeConfig', storeId))
  return normalizeStoreConfig(snap.exists() ? snap.data() : {})
}

export function saveStoreConfig(storeId, config) {
  return setDoc(doc(db, 'storeConfig', storeId), {
    ...config,
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

export async function loadAllowedEmails() {
  const snap = await getDocs(collection(db, 'allowedEmails'))
  return snap.docs.map(docSnap => docSnap.id)
}

export function addAllowedEmail(email) {
  return setDoc(doc(db, 'allowedEmails', email), { addedAt: serverTimestamp() })
}

export function removeAllowedEmail(email) {
  return deleteDoc(doc(db, 'allowedEmails', email))
}
