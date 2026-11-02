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

// 1回の書き込みは500件まで（Firestore の上限）。余裕を見て400件ずつに分ける。
const BATCH_LIMIT = 400

async function commitInChunks(rows, write) {
  for (let start = 0; start < rows.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db)
    rows.slice(start, start + BATCH_LIMIT).forEach(row => write(batch, row))
    await batch.commit()
  }
}

// 並べ替え：変わった分だけ保存する（ふつうは動かした1件）。
function batchUpdateSortOrder(collectionName, updates) {
  return commitInChunks(updates, (batch, update) => {
    batch.update(doc(db, collectionName, update.id), { sortOrder: update.sortOrder, updatedAt: serverTimestamp() })
  })
}

// まとめて登録：商品を400件ずつ新しく作る。
export function batchCreateProductRecords(payloads) {
  return commitInChunks(payloads, (batch, payload) => {
    batch.set(doc(collection(db, 'products')), payload)
  })
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
