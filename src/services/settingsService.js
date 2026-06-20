import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { normalizeStoreConfig } from '../lib/settingsConfig'
import { STORE_NAME_FALLBACK, normalizeStoreName, validateStoreName } from '../lib/storeIdentity'
import {
  deleteAllowedEmail,
  loadAllowedEmailEntries,
  saveAllowedEmail,
  subscribeAllowedEmailEntries,
} from './ownerAccessService'

export async function loadStoreCode(storeId) {
  const identity = await loadStoreIdentity(storeId)
  return identity.storeCode
}

export async function loadStoreIdentity(storeId) {
  const snap = await getDoc(doc(db, 'stores', storeId))
  if (!snap.exists()) {
    return {
      storeCode: '',
      storeName: STORE_NAME_FALLBACK,
    }
  }

  const data = snap.data()
  return {
    storeCode: data.storeCode ?? '',
    storeName: normalizeStoreName(data.storeName),
  }
}

export async function saveStoreName(storeId, storeName, updatedBy) {
  const validationError = validateStoreName(storeName)
  if (validationError) throw new Error(validationError)

  const normalizedName = normalizeStoreName(storeName)
  await updateDoc(doc(db, 'stores', storeId), {
    storeName: normalizedName,
    storeNameUpdatedAt: serverTimestamp(),
    storeNameUpdatedBy: updatedBy ?? null,
  })
  return normalizedName
}

export async function loadStoreConfig(storeId) {
  const snap = await getDoc(doc(db, 'storeConfig', storeId))
  return normalizeStoreConfig(snap.exists() ? snap.data() : {})
}

export async function loadStoreConfigProducts(storeId) {
  const snap = await getDocs(query(collection(db, 'products'), where('storeId', '==', storeId)))
  return snap.docs
    .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
    .filter(product => product.isVisible !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
}

export function saveStoreConfig(storeId, config) {
  return setDoc(doc(db, 'storeConfig', storeId), {
    ...config,
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

export async function loadAllowedEmails() {
  const entries = await loadAllowedEmailEntries()
  return entries.map(entry => entry.email)
}

export function subscribeAllowedEmails(onNext) {
  return subscribeAllowedEmailEntries(entries => {
    onNext(entries.map(entry => entry.email))
  })
}

export function addAllowedEmail(email, addedBy = null) {
  return saveAllowedEmail({ email, addedBy })
}

export function removeAllowedEmail(email) {
  return deleteAllowedEmail(email)
}
