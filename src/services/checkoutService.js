import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { completeCheckoutCommand } from './orderCommandService'

export async function loadCheckoutData({ orderId, storeId }) {
  const [itemsSnap, configSnap, orderSnap] = await Promise.all([
    getDocs(query(collection(db, 'orderItems'), where('orderId', '==', orderId))),
    storeId ? getDoc(doc(db, 'storeConfig', storeId)) : Promise.resolve(null),
    getDoc(doc(db, 'orders', orderId)),
  ])

  return {
    items: itemsSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(item => item.itemStatus !== 'cancelled'),
    orderItemsRevision: orderSnap.exists() ? (orderSnap.data()?.orderItemsRevision ?? 0) : 0,
    taxRate: configSnap?.exists() ? (configSnap.data()?.taxRate ?? 0) : 0,
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
