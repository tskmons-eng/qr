import { addDoc, collection, doc, getDoc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { buildCustomerOrderItemPayload } from '../lib/customerCart'
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

async function loadAutoAddProduct(guestAutoAdd) {
  if (!guestAutoAdd?.enabled || !guestAutoAdd.productId) return null
  const productSnap = await getDoc(doc(db, 'products', guestAutoAdd.productId))
  if (!productSnap.exists()) return null

  const product = { id: productSnap.id, ...productSnap.data() }
  let categoryGroup = product.categoryGroup ?? ''
  if (!categoryGroup && product.categoryId) {
    const categorySnap = await getDoc(doc(db, 'categories', product.categoryId))
    categoryGroup = categorySnap.exists() ? (categorySnap.data().group ?? '') : ''
  }

  return {
    ...product,
    categoryGroup,
    name: product.name ?? guestAutoAdd.productNameSnapshot ?? '',
  }
}

export async function createCustomerOrderSession({ guestAutoAdd, guestCount, storeId, tableId }) {
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

  const autoAddProduct = await loadAutoAddProduct(guestAutoAdd)
  if (autoAddProduct) {
    await addDoc(collection(db, 'orderItems'), buildCustomerOrderItemPayload({
      cartItem: {
        product: autoAddProduct,
        quantity: guestCount,
        optionSelections: [],
      },
      orderId: orderRef.id,
      storeId,
      tableId,
      timestamp: openedAt,
    }))
  }

  await updateDoc(doc(db, 'tables', tableId), {
    status: 'occupied',
    guestCount,
    currentOrderId: orderRef.id,
    startedAt: serverTimestamp(),
    pendingCount: autoAddProduct ? 1 : 0,
    updatedAt: serverTimestamp(),
  })

  return orderRef.id
}
