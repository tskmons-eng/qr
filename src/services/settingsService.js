import { collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { normalizeStoreConfig } from '../lib/settingsConfig'
import { STORE_NAME_FALLBACK, normalizeStoreName, validateStoreName } from '../lib/storeIdentity'

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

// 店舗設定の変更をすぐ受け取る。管理画面で変えた設定が、開いたままのスタッフ画面・厨房にも反映される。
export function subscribeStoreConfig(storeId, onNext, onError) {
  return onSnapshot(
    doc(db, 'storeConfig', storeId),
    snap => onNext(normalizeStoreConfig(snap.exists() ? snap.data() : {})),
    onError,
  )
}

// 変えた項目だけを保存する（押したら保存）。guestAutoAdd のような入れ子も、渡した項目だけが上書きされる。
export function saveStoreConfigPatch(storeId, patch) {
  return setDoc(doc(db, 'storeConfig', storeId), {
    ...patch,
    updatedAt: serverTimestamp(),
  }, { merge: true })
}
