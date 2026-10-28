import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  getCustomerOrderStatusMeta,
  getCheckoutConfirmMessage,
  getCustomerOrderSettings,
  groupCustomerOrderItemsByStatus,
  isCustomerOrderRequestReflected,
  normalizeCustomerOrderItemStatus,
  sortCustomerOrderItems,
  summarizeOrderItems,
} from '../src/lib/customerOrderStatus.js'

assert.deepEqual(getCustomerOrderSettings(null), {
  servedWorkflowEnabled: true,
  showServedStatus: true,
  showItemPrice: true,
  allowAdditionalOrders: true,
})
assert.deepEqual(getCustomerOrderSettings({ showItemPrice: false }), {
  servedWorkflowEnabled: true,
  showServedStatus: true,
  showItemPrice: false,
  allowAdditionalOrders: true,
})
assert.deepEqual(getCustomerOrderSettings({ servedWorkflowEnabled: false, showServedStatus: true }), {
  servedWorkflowEnabled: false,
  showServedStatus: false,
  showItemPrice: true,
  allowAdditionalOrders: true,
})

const summary = summarizeOrderItems([
  { itemStatus: 'ordered', lineTotal: 1200 },
  { itemStatus: 'served', lineTotal: 800 },
  { itemStatus: 'served', lineTotal: 500 },
  { itemStatus: 'cancelled', lineTotal: 9999 },
], 2)

assert.equal(summary.total, 2500)
assert.equal(summary.orderedCount, 1)
assert.equal(summary.servedCount, 2)
assert.equal(summary.cancelledCount, 1)
assert.equal(summary.itemCount, 3)
assert.equal(summary.visibleItemCount, 4)
assert.equal(summary.perPerson, 1250)

assert.equal(summarizeOrderItems([{ itemStatus: 'ordered', lineTotal: 999 }], 1).perPerson, null)
assert.equal(getCheckoutConfirmMessage(0), undefined)
assert.equal(getCheckoutConfirmMessage(1234), '現在の合計は¥1,234です。スタッフに会計希望を送ります。')

assert.equal(normalizeCustomerOrderItemStatus(undefined), 'ordered')
assert.equal(normalizeCustomerOrderItemStatus('cancelled'), 'cancelled')
assert.equal(getCustomerOrderStatusMeta('served').sectionTitle, '提供済み')
assert.equal(getCustomerOrderStatusMeta('served', { showServedStatus: false }).sectionTitle, '注文済み')

const items = [
  { id: 'cancelled-1', itemStatus: 'cancelled', clientRequestId: 'request-1', orderedAt: { seconds: 2 } },
  { id: 'ordered-1', itemStatus: 'ordered', clientRequestId: 'request-2', orderedAt: { seconds: 1 } },
  { id: 'served-1', itemStatus: 'served', clientRequestId: 'request-3', orderedAt: { seconds: 3 } },
]

assert.deepEqual(sortCustomerOrderItems(items).map(item => item.id), ['ordered-1', 'cancelled-1', 'served-1'])

const grouped = groupCustomerOrderItemsByStatus(items, { showServedStatus: true })
assert.deepEqual(grouped.map(section => section.key), ['ordered', 'served', 'cancelled'])
assert.equal(grouped.find(section => section.key === 'cancelled').items[0].customerStatusLabel, 'キャンセル')

const groupedWithoutServed = groupCustomerOrderItemsByStatus(items, { showServedStatus: false })
assert.deepEqual(groupedWithoutServed.map(section => section.key), ['ordered', 'cancelled'])
assert.equal(groupedWithoutServed.find(section => section.key === 'ordered').items.length, 2)

assert.equal(isCustomerOrderRequestReflected(items, 'request-1'), true)
assert.equal(isCustomerOrderRequestReflected(items, 'missing-request'), false)
assert.equal(isCustomerOrderRequestReflected(items, ''), false)

const statusServiceSource = readFileSync(new URL('../src/services/customerOrderStatusService.js', import.meta.url), 'utf8')
assert.match(statusServiceSource, /sortCustomerOrderItems/)
assert.doesNotMatch(statusServiceSource, /itemStatus\s*!==\s*['"]cancelled['"]/)

const completePageSource = readFileSync(new URL('../src/pages/order/OrderCompletePage.jsx', import.meta.url), 'utf8')
assert.match(completePageSource, /isCustomerOrderRequestReflected/)
assert.match(completePageSource, /OrderReflectionNotice/)
assert.match(completePageSource, /latestClientRequestId/)
assert.match(completePageSource, /loadCustomerSubmitRecovery/)
assert.match(completePageSource, /clearCustomerSubmitRecovery/)
assert.match(completePageSource, /CUSTOMER_SUBMIT_RECOVERY_ACTION_DELAY_MS/)
assert.match(completePageSource, /submitCustomerCartOrder/)
assert.match(completePageSource, /同じ内容で再送/)
assert.match(completePageSource, /保存済みの可能性/)
assert.match(completePageSource, /OrderCheckoutNotice/)
// 2026-10-28 注文の流れ 第2章：お会計の依頼は1回押すだけ。合計は「金額を出す」設定か、依頼のあとに出す。
assert.match(completePageSource, /お会計をお願いする/)
assert.match(completePageSource, /const showTotal = showItemPrice \|\| checkoutSent/)
assert.match(completePageSource, /showItemPrice=\{showItemPrice \|\| checkoutSent\}/)
assert.match(completePageSource, /お会計を依頼しました/)
assert.doesNotMatch(completePageSource, /カートに未注文の商品/)
assert.doesNotMatch(completePageSource, /order-status__checkout-cart-button/)
assert.doesNotMatch(completePageSource, /setCheckoutStep\('confirming'\)/)
assert.match(completePageSource, /current="history"/)
assert.match(completePageSource, /ご注文を受け付けました/)

const cartSheetSource = readFileSync(new URL('../src/components/order/CartSheet.jsx', import.meta.url), 'utf8')
assert.match(cartSheetSource, /clientRequestId:\s*completedRequestId/)
assert.match(cartSheetSource, /submittedItemCount:\s*items\.length/)

const statusListSource = readFileSync(new URL('../src/components/order/OrderStatusList.jsx', import.meta.url), 'utf8')
assert.match(statusListSource, /groupCustomerOrderItemsByStatus/)
assert.match(statusListSource, /今回追加/)
assert.match(statusListSource, /会計対象外/)
assert.match(statusListSource, /保存済みの場合はまもなく表示されます/)

const statusSummarySource = readFileSync(new URL('../src/components/order/OrderStatusSummary.jsx', import.meta.url), 'utf8')
assert.match(statusSummarySource, /const visibleOrderedCount = showServedStatus \? orderedCount : orderedCount \+ servedCount/)

const statusHeaderSource = readFileSync(new URL('../src/components/order/OrderStatusHeader.jsx', import.meta.url), 'utf8')
assert.match(statusHeaderSource, /注文履歴・お会計/)
assert.match(statusHeaderSource, /CustomerTopBar/)

const totalPanelSource = readFileSync(new URL('../src/components/order/OrderTotalPanel.jsx', import.meta.url), 'utf8')
assert.match(totalPanelSource, /label = '合計'/)
assert.match(completePageSource, /label="お会計合計"/)

console.log('customer order status checks passed')
