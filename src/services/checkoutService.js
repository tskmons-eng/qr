import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { normalizeStoreConfig } from '../lib/settingsConfig'
import { completeCheckoutCommand } from './orderCommandService'

// 会計の品・注文の版・税率を見続ける（2026-10-29 レジ 第1章）。
// 会計の途中に追加注文が届いても、入れた値引きとお預かりを消さずに合計だけ直せるように、開いている間ずっと読む。
// 品と注文の版の両方が届いてから onChange を呼ぶ。itemsFromServer は、品が端末の控えではなくサーバーから届いたものか。
export function subscribeCheckoutData({ orderId, storeId }, onChange, onError) {
  let stopped = false
  let items = null
  let itemsFromServer = false
  let orderItemsRevision = null
  let taxRate = null
  const emit = () => {
    if (stopped || !items || orderItemsRevision === null || taxRate === null) return
    onChange({ items, itemsFromServer, orderItemsRevision, taxRate })
  }
  // 税率は「うち税」の表示だけに使う。読めなくても会計は止めず、店の既定の税率で表示する（記録はサーバーが店の設定から計算する）。
  getDoc(doc(db, 'storeConfig', storeId))
    .then(configSnap => normalizeStoreConfig(configSnap.exists() ? configSnap.data() : {}).taxRate)
    .catch(() => normalizeStoreConfig({}).taxRate)
    .then(rate => { taxRate = rate; emit() })
  // 店で絞って読む（注文の品は店の人とその注文のお客様だけが読める決まり。2026-10-29 QR 第2章）。
  const stopItems = onSnapshot(query(collection(db, 'orderItems'), where('storeId', '==', storeId), where('orderId', '==', orderId)), { includeMetadataChanges: true }, snap => {
    items = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(item => item.itemStatus !== 'cancelled')
    itemsFromServer = !snap.metadata.fromCache
    emit()
  }, onError)
  const stopOrder = onSnapshot(doc(db, 'orders', orderId), snap => {
    orderItemsRevision = snap.exists() ? (snap.data()?.orderItemsRevision ?? 0) : 0
    emit()
  }, onError)
  return () => { stopped = true; stopItems(); stopOrder() }
}

export async function completeCheckout({
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
  checkoutDiscountType,
  checkoutDiscountValue,
  checkoutDiscountAmount,
  totalDiscountAmount,
  discountNote,
  total,
  paymentMethod,
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
    checkoutDiscountType,
    checkoutDiscountValue,
    checkoutDiscountAmount,
    totalDiscountAmount,
    discountNote,
    total,
    paymentMethod,
    received,
    change,
    activeStaff,
  })
}
