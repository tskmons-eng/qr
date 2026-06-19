import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createCartItemId } from '../src/lib/cartItemId.js'
import {
  buildCustomerOrderItemPayload,
  calculateCartItemPricing,
  formatCartOptions,
  normalizeCartQuantity,
} from '../src/lib/customerCart.js'
import {
  CUSTOMER_SUBMIT_RECOVERY_ACTION_DELAY_MS,
  clearCustomerSubmitRecovery,
  createCustomerSubmitRecovery,
  loadCustomerSubmitRecovery,
  markCustomerSubmitRecoveryAccepted,
  markCustomerSubmitRecoveryAttempt,
  saveCustomerSubmitRecovery,
  shouldShowCustomerSubmitRecoveryActions,
} from '../src/lib/customerSubmitRecovery.js'

function createMemoryStorage() {
  const values = new Map()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
}

assert.equal(formatCartOptions([]), null)
assert.equal(formatCartOptions([{ choice: 'Large' }, { choice: 'Ice' }]), 'Large · Ice')
assert.equal(normalizeCartQuantity('abc'), 0)
assert.equal(normalizeCartQuantity('-2'), 0)
assert.equal(normalizeCartQuantity('120'), 99)

const generatedCartIds = Array.from({ length: 20 }, () => createCartItemId('product-1'))
assert.equal(new Set(generatedCartIds).size, generatedCartIds.length, 'cart item ids should not collide during same-tick multi option adds')
assert.ok(generatedCartIds.every(id => id.startsWith('product-1_')), 'cart item ids should keep a product prefix for debugging')

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

const storage = createMemoryStorage()
const recovery = createCustomerSubmitRecovery({
  items: [{ id: 'cart-1', product, quantity: 2, optionSelections }],
  orderId: 'o1',
  storeId: 's1',
  tableId: 't1',
  clientRequestId: 'request-1',
  now: 1000,
})
assert.equal(recovery.clientRequestId, 'request-1')
assert.equal(recovery.submittedItemCount, 1)
assert.equal(recovery.items[0].product.name, 'Coffee')
assert.equal(saveCustomerSubmitRecovery(recovery, storage).status, 'pending')

const loadedRecovery = loadCustomerSubmitRecovery({ orderId: 'o1', storeId: 's1', tableId: 't1' }, storage, 1200)
assert.equal(loadedRecovery.clientRequestId, 'request-1')
assert.equal(loadCustomerSubmitRecovery({ orderId: 'other' }, storage, 1200), null)

saveCustomerSubmitRecovery(recovery, storage)
const attemptedRecovery = markCustomerSubmitRecoveryAttempt({ orderId: 'o1', storeId: 's1', tableId: 't1' }, storage, 1500)
assert.equal(attemptedRecovery.attemptCount, 2)
assert.equal(attemptedRecovery.lastAttemptAt, 1500)

const acceptedRecovery = markCustomerSubmitRecoveryAccepted({ orderId: 'o1', storeId: 's1', tableId: 't1', clientRequestId: 'request-1' }, storage, 2000)
assert.equal(acceptedRecovery.status, 'accepted')
assert.equal(shouldShowCustomerSubmitRecoveryActions(acceptedRecovery, 2000 + CUSTOMER_SUBMIT_RECOVERY_ACTION_DELAY_MS - 1), false)
assert.equal(shouldShowCustomerSubmitRecoveryActions(acceptedRecovery, 2000 + CUSTOMER_SUBMIT_RECOVERY_ACTION_DELAY_MS), true)
assert.equal(clearCustomerSubmitRecovery({ orderId: 'o1', storeId: 's1', tableId: 't1', clientRequestId: 'request-1' }, storage, 2500), true)
assert.equal(loadCustomerSubmitRecovery({ orderId: 'o1', storeId: 's1', tableId: 't1' }, storage), null)

const cartPageSource = readFileSync(new URL('../src/pages/order/CartPage.jsx', import.meta.url), 'utf8')
assert.match(cartPageSource, /submitRequestIdRef\.current = createOrderCommandRequestId\('customer-order'\)/)
assert.match(cartPageSource, /const completedRequestId = submitRequestIdRef\.current/)
assert.match(cartPageSource, /clientRequestId: completedRequestId/)
assert.match(cartPageSource, /clearCart\(\)[\s\S]*submitRequestIdRef\.current = null/)
assert.match(cartPageSource, /formatted\.retryable/)
assert.match(cartPageSource, /retryable: formatted\.retryable/)
assert.match(cartPageSource, /saveCustomerSubmitRecovery/)
assert.match(cartPageSource, /loadCustomerSubmitRecovery/)
assert.match(cartPageSource, /recoveringPendingSubmit/)
assert.doesNotMatch(cartPageSource, /onCheckout=\{handleCheckout\}/)

const bottomNavSource = readFileSync(new URL('../src/components/CustomerBottomNav.jsx', import.meta.url), 'utf8')
assert.match(bottomNavSource, /checkoutPreview: true/)
assert.match(bottomNavSource, /カート/)
assert.match(bottomNavSource, /\$\{count\}点/)
assert.doesNotMatch(bottomNavSource, /total\.toLocaleString/)
assert.doesNotMatch(bottomNavSource, /注文確認/)

const cartHeaderSource = readFileSync(new URL('../src/components/order/CartHeader.jsx', import.meta.url), 'utf8')
assert.match(cartHeaderSource, /注文前のカート/)

const cartItemListSource = readFileSync(new URL('../src/components/order/CartItemList.jsx', import.meta.url), 'utf8')
assert.doesNotMatch(cartItemListSource, /calculateCartItemPricing/)
assert.doesNotMatch(cartItemListSource, /customer-cart__total-row/)
assert.doesNotMatch(cartItemListSource, /lineTotal/)
assert.doesNotMatch(cartItemListSource, /unitPrice/)

const cartSubmitBarSource = readFileSync(new URL('../src/components/order/CartSubmitBar.jsx', import.meta.url), 'utf8')
assert.match(cartSubmitBarSource, /この内容で注文する/)
assert.doesNotMatch(cartSubmitBarSource, /total\.toLocaleString/)

const cartFloatingButtonSource = readFileSync(new URL('../src/components/order/CartFloatingButton.jsx', import.meta.url), 'utf8')
assert.match(cartFloatingButtonSource, /カートを確認/)
assert.match(cartFloatingButtonSource, /\{count\}点/)
assert.doesNotMatch(cartFloatingButtonSource, /total\.toLocaleString/)

const menuPageSource = readFileSync(new URL('../src/pages/order/MenuPage.jsx', import.meta.url), 'utf8')
assert.doesNotMatch(menuPageSource, /onCheckout=\{handleCheckout\}/)
assert.match(menuPageSource, /customerMenuTapToAddEnabled=\{storeConfig\.customerMenuTapToAddEnabled !== false\}/)

const customerMenuProductListSource = readFileSync(new URL('../src/components/order/CustomerMenuProductList.jsx', import.meta.url), 'utf8')
assert.match(customerMenuProductListSource, /customerMenuTapToAddEnabled = true/)
assert.match(customerMenuProductListSource, /const rowTapEnabled = customerMenuTapToAddEnabled && !product\.isSoldOut/)
assert.match(customerMenuProductListSource, /const TapArea = rowTapEnabled \? 'button' : 'div'/)
assert.match(customerMenuProductListSource, /onSetSimpleProductQuantity\(product, \(simpleItem\?\.quantity \?\? 0\) \+ 1\)/)
assert.match(customerMenuProductListSource, /event\.stopPropagation\(\)/)
assert.match(customerMenuProductListSource, /'aria-label': tapLabel/)

console.log('customer cart checks passed')
