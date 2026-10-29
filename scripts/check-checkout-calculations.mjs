import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
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


// 2026-10-29 レジ 第1章：サーバーも同じ計算で合計を確かめる。画面とサーバーが同じ答えを出すこと。
const server = createRequire(import.meta.url)('../functions/checkoutCalculations.js')
const sampleItems = [
  { id: 'a', productNameSnapshot: 'A', quantity: 3, lineTotal: 1000 },
  { id: 'b', productNameSnapshot: 'B', quantity: 1, lineTotal: 480 },
  { id: 'c', productNameSnapshot: 'C', quantity: 2, lineTotal: 777 },
]
const cases = [
  { itemDiscounts: {}, discountType: null, discountValue: '', receivedCash: '5000' },
  { itemDiscounts: { a: { type: 'percent', value: 15, note: ' x ' } }, discountType: 'amount', discountValue: '120', receivedCash: '2257' },
  { itemDiscounts: { b: { type: 'amount', value: 999 }, c: { type: 'percent', value: 33 } }, discountType: 'percent', discountValue: '7', receivedCash: '10000' },
  { itemDiscounts: { a: { type: 'amount', value: 50 } }, discountType: 'percent', discountValue: '150', receivedCash: '0' },
]
for (const [index, input] of cases.entries()) {
  for (const taxRate of [0, 8, 10]) {
    const client = calculateCheckoutTotals({ items: sampleItems, taxRate, ...input })
    assert.equal(server.calcDiscount(client.subtotal, input.discountType, input.discountValue), client.discountAmount, `case ${index} discount`)
    const data = {
      activeItemDiscounts: client.activeItemDiscounts,
      checkoutDiscountType: input.discountType,
      checkoutDiscountValue: input.discountValue,
      itemDiscountAmount: client.itemDiscountAmount,
      subtotal: client.subtotal,
      checkoutDiscountAmount: client.discountAmount,
      total: client.total,
      received: client.received,
      change: client.change,
      paymentMethod: 'cash',
    }
    if (client.change === null) {
      assert.throws(() => server.recalculateCheckout({ items: sampleItems, data, taxRate }), /less than the total/, `case ${index} short cash`)
      continue
    }
    const result = server.recalculateCheckout({ items: sampleItems, data, taxRate })
    assert.equal(result.total, client.total, `case ${index} total`)
    assert.equal(result.taxAmount, client.taxAmount, `case ${index} tax`)
    assert.equal(result.change, client.change, `case ${index} change`)
    assert.deepEqual(result.activeItemDiscounts, client.activeItemDiscounts, `case ${index} item discounts`)
  }
}
const baseData = { activeItemDiscounts: [], itemDiscountAmount: 0, subtotal: 2257, checkoutDiscountAmount: 0, total: 2257, received: 3000, change: 743 }
// 古い画面（会計の値引きの種類を送らない）は、送った金額の値引きとして通す。
assert.equal(server.recalculateCheckout({ items: sampleItems, data: { ...baseData, checkoutDiscountAmount: 257, total: 2000, change: 1000 }, taxRate: 10 }).total, 2000)
// 画面の合計が品と合わなければ断る。
assert.throws(() => server.recalculateCheckout({ items: sampleItems, data: { ...baseData, total: 100, change: 2900 }, taxRate: 10 }), /does not match/)
// 品に無い値引きは使わない（合計が合わなくなるので断る）。
assert.throws(() => server.recalculateCheckout({ items: sampleItems, data: { ...baseData, activeItemDiscounts: [{ orderItemId: 'zzz', type: 'amount', value: 500 }], itemDiscountAmount: 500, subtotal: 1757, total: 1757, change: 1243 }, taxRate: 10 }), /does not match/)
// お預かりが足りない現金の会計は断る。
assert.throws(() => server.recalculateCheckout({ items: sampleItems, data: { ...baseData, received: 1000, change: null }, taxRate: 10 }), /less than the total/)
// 現金以外はお預かり・お釣りを持たない。知らない支払い方法は断る。
const card = server.recalculateCheckout({ items: sampleItems, data: { ...baseData, paymentMethod: 'card', received: 0, change: 0 }, taxRate: 10 })
assert.equal(card.received, 2257)
assert.equal(card.change, 0)
assert.throws(() => server.recalculateCheckout({ items: sampleItems, data: { ...baseData, paymentMethod: 'bitcoin' }, taxRate: 10 }), /Unknown payment method/)
// 税率の読み方は画面（src/lib/settingsConfig.js）と同じ。
const { normalizeStoreConfig } = await import('../src/lib/settingsConfig.js')
for (const value of [undefined, null, '', '8', 8, 0, '0', -1, 101, 'abc', 12.5]) {
  assert.equal(server.normalizeTaxRate(value), normalizeStoreConfig({ taxRate: value }).taxRate, `tax rate ${String(value)}`)
}
const handlers = await readFile('functions/orderCommandHandlers.js', 'utf8')
assert.ok(handlers.indexOf('assertCheckoutItemsFresh({\n      checkoutItemIds') < handlers.indexOf('recalculateCheckout({'), '品が変わったかを先に確かめてから合計を確かめる')
assert.ok(checkoutPage.includes('subscribeCheckoutData('), '会計の品を見続ける')
assert.ok(!checkoutPage.includes('setReceivedCash(\'\')'), '品が変わってもお預かりを消さない')

console.log('checkout calculation checks passed')
