import assert from 'node:assert/strict'
import {
  buildCustomerOrderItemPayload,
  calculateCartItemPricing,
  formatCartOptions,
  normalizeCartQuantity,
} from '../src/lib/customerCart.js'

assert.equal(formatCartOptions([]), null)
assert.equal(formatCartOptions([{ choice: 'Large' }, { choice: 'Ice' }]), 'Large · Ice')
assert.equal(normalizeCartQuantity('abc'), 0)
assert.equal(normalizeCartQuantity('-2'), 0)
assert.equal(normalizeCartQuantity('120'), 99)

const product = {
  id: 'p1',
  name: 'Coffee',
  price: 500,
  categoryGroup: 'drink',
  discountConfig: { enabled: true, type: 'amount', value: 100 },
}
const optionSelections = [{ groupName: 'Size', choice: 'Large', extraPrice: 50 }]
const pricing = calculateCartItemPricing({ product, optionSelections, quantity: 2 })

assert.equal(pricing.originalPrice, 500)
assert.equal(pricing.discountAmount, 100)
assert.equal(pricing.unitPrice, 450)
assert.equal(pricing.regularUnitPrice, 550)
assert.equal(pricing.lineTotal, 900)

assert.deepEqual(buildCustomerOrderItemPayload({
  cartItem: { product, quantity: 2, optionSelections },
  orderId: 'o1',
  storeId: 's1',
  tableId: 't1',
  timestamp: 'now',
}), {
  orderId: 'o1',
  storeId: 's1',
  tableId: 't1',
  productId: 'p1',
  productNameSnapshot: 'Coffee',
  unitPriceSnapshot: 500,
  unitDiscountSnapshot: 100,
  discountConfigSnapshot: product.discountConfig,
  categoryGroup: 'drink',
  quantity: 2,
  lineTotal: 900,
  orderedBy: 'customer',
  itemStatus: 'ordered',
  optionSelections,
  orderedAt: 'now',
  updatedAt: 'now',
})

console.log('customer cart checks passed')
