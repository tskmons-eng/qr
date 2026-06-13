import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { buildEmptyTablePendingAggregateFields } from '../lib/tablePending'

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
  const now = serverTimestamp()
  const checkRef = await addDoc(collection(db, 'checks'), {
    storeId,
    tableId,
    orderId,
    guestCount: guestCount ?? 0,
    subtotalBeforeItemDiscount,
    itemDiscountAmount,
    itemDiscounts: activeItemDiscounts,
    subtotal,
    checkoutDiscountAmount,
    discountAmount: totalDiscountAmount,
    discountNote: discountNote?.trim() || null,
    total,
    receivedCash: received,
    changeAmount: change,
    paymentMethod: 'cash',
    status: 'completed',
    closedByStaffId: activeStaff?.id ?? null,
    closedByStaffName: activeStaff?.name ?? null,
    completedAt: now,
    updatedAt: now,
  })

  await updateDoc(doc(db, 'orders', orderId), {
    status: 'checked_out',
    checkedOutAt: now,
    updatedAt: now,
  })

  await updateDoc(doc(db, 'tables', tableId), {
    status: 'vacant',
    guestCount: 0,
    currentOrderId: null,
    startedAt: null,
    pendingCount: 0,
    ...buildEmptyTablePendingAggregateFields(),
    updatedAt: now,
  })

  await addDoc(collection(db, 'staffActions'), {
    storeId,
    actionType: checkoutDiscountAmount > 0 || itemDiscountAmount > 0 ? 'checkout_discount' : 'checkout',
    targetType: 'check',
    targetId: checkRef.id,
    actorType: 'staff',
    actorStaffId: activeStaff?.id ?? null,
    actorStaffName: activeStaff?.name ?? null,
    note: `会計完了 ¥${total.toLocaleString()}`,
    createdAt: now,
  })

  return checkRef.id
}
