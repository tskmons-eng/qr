import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { completeCheckoutCommand } from './orderCommandService'

export async function loadCheckoutData({ orderId, storeId }) {
  const [itemsSnap, configSnap] = await Promise.all([
    getDocs(query(collection(db, 'orderItems'), where('orderId', '==', orderId))),
    storeId ? getDoc(doc(db, 'storeConfig', storeId)) : Promise.resolve(null),
  ])

  return {
    items: itemsSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(item => item.itemStatus !== 'cancelled'),
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
