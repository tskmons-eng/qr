import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { normalizeStoreConfig } from '../lib/settingsConfig'
import { completeCheckoutCommand } from './orderCommandService'

export async function loadCheckoutData({ orderId, storeId }) {
  const [itemsSnap, configSnap, orderSnap] = await Promise.all([
    // 店で絞って読む（注文の品は店の人とその注文のお客様だけが読める決まり。2026-10-29 QR 第2章）。
    getDocs(query(collection(db, 'orderItems'), where('storeId', '==', storeId), where('orderId', '==', orderId))),
    storeId ? getDoc(doc(db, 'storeConfig', storeId)) : Promise.resolve(null),
    getDoc(doc(db, 'orders', orderId)),
  ])

  return {
    items: itemsSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(item => item.itemStatus !== 'cancelled'),
    orderItemsRevision: orderSnap.exists() ? (orderSnap.data()?.orderItemsRevision ?? 0) : 0,
    taxRate: normalizeStoreConfig(configSnap?.exists() ? configSnap.data() : {}).taxRate,
  }
}

export async function completeCashCheckout({
  storeId,
  tableId,
  orderId,
  guestCount,
  subtotalBeforeItemDiscount,
  itemDiscountAmount,
  activeItemDiscounts,
  checkoutItemIds,
  orderItemsRevision,
  subtotal,
  checkoutDiscountAmount,
  totalDiscountAmount,
  discountNote,
  total,
  received,
  change,
  activeStaff,
}) {
  return completeCheckoutCommand({
    storeId,
    tableId,
    orderId,
    guestCount,
    subtotalBeforeItemDiscount,
    itemDiscountAmount,
    activeItemDiscounts,
    checkoutItemIds,
    orderItemsRevision,
    subtotal,
    checkoutDiscountAmount,
    totalDiscountAmount,
    discountNote,
    total,
    received,
    change,
    activeStaff,
  })
}
