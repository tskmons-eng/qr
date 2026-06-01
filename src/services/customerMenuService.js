import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../lib/firebase'

export async function loadCustomerMenuData(storeId) {
  const [catSnap, prodSnap] = await Promise.all([
    getDocs(query(collection(db, 'categories'), where('storeId', '==', storeId))),
    getDocs(query(collection(db, 'products'), where('storeId', '==', storeId))),
  ])

  const categories = catSnap.docs
    .map(record => ({ id: record.id, ...record.data() }))
    .filter(category => category.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const categoryGroupMap = Object.fromEntries(categories.map(category => [category.id, category.group ?? '']))
  const products = prodSnap.docs
    .map(record => ({ id: record.id, ...record.data() }))
    .filter(product => product.isVisible)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(product => ({ ...product, categoryGroup: categoryGroupMap[product.categoryId] ?? '' }))

  return { categories, products }
}

export function createCustomerCall({ storeId, tableId, tableName, orderId, type }) {
  return addDoc(collection(db, 'calls'), {
    storeId,
    tableId,
    tableName,
    orderId: orderId ?? null,
    type,
    status: 'pending',
    createdAt: serverTimestamp(),
  })
}
