import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'

// メニュー管理の読み書き（2026-10-23 商品設計で作り直し）。テンプレート・タグセットは無くした。

function bySortOrder(a, b) {
  return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)
}

function snapshotRows(snapshot) {
  return snapshot.docs.map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() }))
}

export async function loadProductAdminData(storeId) {
  const [prodSnap, catSnap] = await Promise.all([
    getDocs(query(collection(db, 'products'), where('storeId', '==', storeId))),
    getDocs(query(collection(db, 'categories'), where('storeId', '==', storeId))),
  ])

  return {
    products: snapshotRows(prodSnap).sort(bySortOrder),
    categories: snapshotRows(catSnap).sort(bySortOrder),
  }
}

export async function createProductRecord(payload) {
  const ref = await addDoc(collection(db, 'products'), payload)
  return ref.id
}

export function updateProductRecord(productId, payload) {
  return updateDoc(doc(db, 'products', productId), payload)
}

export function deleteProductRecord(productId) {
  return deleteDoc(doc(db, 'products', productId))
}

// 並べ替え：変わった分をまとめて1回で保存する。
async function batchUpdateSortOrder(collectionName, updates) {
  const batch = writeBatch(db)
  updates.forEach(update => {
    batch.update(doc(db, collectionName, update.id), { sortOrder: update.sortOrder, updatedAt: serverTimestamp() })
  })
  await batch.commit()
}

export function batchUpdateProductSortOrderRecords(updates) {
  return batchUpdateSortOrder('products', updates)
}

export function batchUpdateCategorySortOrderRecords(updates) {
  return batchUpdateSortOrder('categories', updates)
}

export async function createCategoryRecord(payload) {
  const ref = await addDoc(collection(db, 'categories'), payload)
  return ref.id
}

export function updateCategoryRecord(categoryId, payload) {
  return updateDoc(doc(db, 'categories', categoryId), payload)
}

export function deleteCategoryRecord(categoryId) {
  return deleteDoc(doc(db, 'categories', categoryId))
}
