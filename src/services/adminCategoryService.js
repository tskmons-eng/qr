import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { buildAdminCategoryActivePayload, buildAdminCategoryPayload, sortAdminCategories } from '../lib/adminCategory'
import { db } from '../lib/firebase'

export function subscribeAdminCategories(storeId, onNext) {
  const categoriesQuery = query(collection(db, 'categories'), where('storeId', '==', storeId))
  return onSnapshot(categoriesQuery, snap => {
    onNext(sortAdminCategories(snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))))
  })
}

export function createAdminCategory({ categoriesCount, name, storeId }) {
  return addDoc(collection(db, 'categories'), buildAdminCategoryPayload({
    storeId,
    name,
    sortOrder: categoriesCount,
    timestamp: serverTimestamp(),
  }))
}

export function toggleAdminCategoryActive(category) {
  return updateDoc(
    doc(db, 'categories', category.id),
    buildAdminCategoryActivePayload(category, serverTimestamp())
  )
}
