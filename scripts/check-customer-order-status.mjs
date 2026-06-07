import assert from 'node:assert/strict'
import {
  getCheckoutConfirmMessage,
  getCustomerOrderSettings,
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
], 2)

assert.equal(summary.total, 2500)
assert.equal(summary.orderedCount, 1)
assert.equal(summary.servedCount, 2)
assert.equal(summary.itemCount, 3)
assert.equal(summary.perPerson, 1250)

assert.equal(summarizeOrderItems([{ itemStatus: 'ordered', lineTotal: 999 }], 1).perPerson, null)
assert.equal(getCheckoutConfirmMessage(0), undefined)
assert.equal(getCheckoutConfirmMessage(1234), '現在の合計は¥1,234です。スタッフに会計希望を送ります。')

console.log('customer order status checks passed')
