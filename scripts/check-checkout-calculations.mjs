import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
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

const checkoutPage = await readFile('src/pages/staff/CheckoutPage.jsx', 'utf8')
const checkoutConfirmBar = await readFile('src/components/staff/CheckoutConfirmBar.jsx', 'utf8')
const checkoutPaymentPanel = await readFile('src/components/staff/CheckoutPaymentPanel.jsx', 'utf8')
const checkoutLayoutStyles = await readFile('src/styles/staff-checkout-layout.css', 'utf8')
const checkoutPaymentStyles = await readFile('src/styles/staff-checkout-payment.css', 'utf8')

assert.ok(checkoutPage.includes('className="checkout-page__body"'), 'checkout page should separate scrollable content from fixed controls')
assert.ok(checkoutPage.includes('className="checkout-page__items-scroll"'), 'checkout item list should have an independent scroll region')
assert.ok(checkoutPage.includes('className="checkout-page__payment"'), 'checkout summary controls should remain outside the item scroll region')
assert.ok(checkoutPage.includes('<CheckoutConfirmBar'), 'checkout cash input should be rendered in the fixed confirm area')
assert.ok(checkoutPage.includes('onReceivedCashChange={setReceivedCash}'), 'checkout cash input handler should be passed to the fixed confirm area')
assert.ok(checkoutConfirmBar.includes('checkout-confirm-bar__cash'), 'checkout cash input should live inside the fixed confirm bar')
assert.ok(checkoutConfirmBar.includes('checkout-cash-input'), 'checkout confirm bar should own the received cash input')
assert.ok(checkoutConfirmBar.includes('checkout-confirm-bar__submit'), 'checkout confirm submit button should be styled separately from cash preset buttons')
assert.ok(!checkoutPaymentPanel.includes('checkout-cash-input'), 'checkout payment summary panel must not contain the received cash input')
assert.ok(checkoutLayoutStyles.includes('.checkout-page__items-scroll'), 'checkout item scroll region should be styled')
assert.ok(checkoutLayoutStyles.includes('max-height: clamp(130px, 28dvh, 220px)'), 'checkout item list should not push payment controls off screen')
assert.ok(checkoutLayoutStyles.includes('overscroll-behavior: contain'), 'checkout item list should contain nested scroll momentum')
assert.ok(checkoutLayoutStyles.includes('.checkout-page__payment'), 'checkout summary controls should have a separate scroll container')
assert.ok(checkoutLayoutStyles.includes('padding-bottom: calc(var(--staff-bottom-nav-offset, 74px) + 270px)'), 'checkout body should leave room for the fixed cash and confirm controls')
assert.ok(checkoutPaymentStyles.includes('bottom: var(--staff-bottom-nav-offset, 74px)'), 'checkout confirm bar should avoid the staff bottom nav')
assert.ok(checkoutPaymentStyles.includes('.checkout-confirm-bar__cash'), 'checkout confirm bar should style the fixed cash input area')

console.log('checkout calculation checks passed')
