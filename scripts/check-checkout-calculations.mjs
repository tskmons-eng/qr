import assert from 'node:assert/strict'
import { calcDiscount, calcItemDiscount, calculateCheckoutTotals } from '../src/lib/checkoutCalculations.js'

assert.equal(calcDiscount(1000, 'amount', 1500), 1000)
assert.equal(calcDiscount(1000, 'percent', 15), 150)
assert.equal(calcDiscount(1000, 'percent', 120), 1000)
assert.equal(calcDiscount(1000, 'amount', ''), 0)

assert.deepEqual(calcItemDiscount({ quantity: 3, lineTotal: 1500 }, 'amount', 100), {
  amount: 300,
  unitPrice: 500,
  unitDiscount: 100,
})

const totals = calculateCheckoutTotals({
  items: [
    { id: 'item-1', productNameSnapshot: 'Lunch', quantity: 2, lineTotal: 2000 },
    { id: 'item-2', productNameSnapshot: 'Drink', quantity: 1, lineTotal: 500 },
  ],
  itemDiscounts: {
    'item-1': { type: 'percent', value: 10, note: 'promo' },
  },
  discountType: 'amount',
  discountValue: 100,
  taxRate: 10,
  receivedCash: '3000',
})

assert.equal(totals.subtotalBeforeItemDiscount, 2500)
assert.equal(totals.itemDiscountAmount, 200)
assert.equal(totals.subtotal, 2300)
assert.equal(totals.discountAmount, 100)
assert.equal(totals.totalDiscountAmount, 300)
assert.equal(totals.total, 2200)
assert.equal(totals.taxAmount, 200)
assert.equal(totals.received, 3000)
assert.equal(totals.change, 800)
assert.deepEqual(totals.activeItemDiscounts, [
  {
    orderItemId: 'item-1',
    productNameSnapshot: 'Lunch',
    quantity: 2,
    unitPrice: 1000,
    type: 'percent',
    value: 10,
    unitDiscountAmount: 100,
    amount: 200,
    note: 'promo',
  },
])

console.log('checkout calculation checks passed')
