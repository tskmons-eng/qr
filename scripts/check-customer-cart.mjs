import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createCartItemId } from '../src/lib/cartItemId.js'
import {
  CART_STORAGE_TTL_MS,
  buildCustomerOrderItemPayload,
  calculateCartItemPricing,
  cartStorageKey,
  formatCartOptions,
  loadSavedCart,
  normalizeCartQuantity,
  saveCart,
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

// 2026-10-28 注文の流れ 第2章：カートはメニューの上のシート（CartSheet）。送信の決まりは前のカート画面と同じ。
const cartSheetSource = readFileSync(new URL('../src/components/order/CartSheet.jsx', import.meta.url), 'utf8')
assert.match(cartSheetSource, /submitRequestIdRef\.current = createOrderCommandRequestId\('customer-order'\)/)
assert.match(cartSheetSource, /const completedRequestId = submitRequestIdRef\.current/)
assert.match(cartSheetSource, /clientRequestId: completedRequestId/)
assert.match(cartSheetSource, /clearCart\(\)[\s\S]*submitRequestIdRef\.current = null/)
assert.match(cartSheetSource, /formatted\.retryable/)
assert.match(cartSheetSource, /retryable: formatted\.retryable/)
assert.match(cartSheetSource, /saveCustomerSubmitRecovery/)
assert.match(cartSheetSource, /recoveringPendingSubmit/)
assert.doesNotMatch(cartSheetSource, /total\.toLocaleString/)
const cartPageSource = readFileSync(new URL('../src/pages/order/CartPage.jsx', import.meta.url), 'utf8')
assert.match(cartPageSource, /openCart: true/)

const bottomNavSource = readFileSync(new URL('../src/components/CustomerBottomNav.jsx', import.meta.url), 'utf8')
assert.match(bottomNavSource, /注文画面のメインメニュー/)
assert.match(bottomNavSource, /メニュー/)
assert.match(bottomNavSource, /注文履歴・お会計/)
assert.match(bottomNavSource, /navigate\('\.\.\/complete'\)/)
assert.doesNotMatch(bottomNavSource, /total\.toLocaleString/)
assert.doesNotMatch(bottomNavSource, /onCall/)
assert.doesNotMatch(bottomNavSource, /onCheckout/)

const cartItemListSource = readFileSync(new URL('../src/components/order/CartItemList.jsx', import.meta.url), 'utf8')
assert.doesNotMatch(cartItemListSource, /calculateCartItemPricing/)
assert.doesNotMatch(cartItemListSource, /customer-cart__total-row/)
assert.doesNotMatch(cartItemListSource, /lineTotal/)
assert.doesNotMatch(cartItemListSource, /unitPrice/)

const cartSubmitBarSource = readFileSync(new URL('../src/components/order/CartSubmitBar.jsx', import.meta.url), 'utf8')
assert.match(cartSubmitBarSource, /\$\{itemCount\}点を注文する/)
assert.doesNotMatch(cartSubmitBarSource, /total\.toLocaleString/)

assert.match(cartSheetSource, /カートは空です/)
assert.match(cartSheetSource, /items\.length === 0/)

const menuPageSource = readFileSync(new URL('../src/pages/order/MenuPage.jsx', import.meta.url), 'utf8')
const customerMenuStyles = readFileSync(new URL('../src/styles/customer-menu.css', import.meta.url), 'utf8')
assert.doesNotMatch(menuPageSource, /onCheckout=\{handleCheckout\}/)
assert.match(menuPageSource, /customerMenuTapToAddEnabled=\{storeConfig\.customerMenuTapToAddEnabled !== false\}/)
assert.match(menuPageSource, /interactionDisabled=\{storeConfigLoading\}/)
assert.match(menuPageSource, /className="customer-menu__scroll"/)
// カートに入ったら下の青い帯から開く。送った注文の確かめが済んでいないときは完了画面へ（二重注文を防ぐ）。
assert.match(menuPageSource, /カートを見て注文する/)
assert.match(menuPageSource, /loadCustomerSubmitRecovery/)
assert.match(menuPageSource, /<CartSheet/)
assert.match(menuPageSource, /ProductPhotoZoom/)
assert.match(customerMenuStyles, /\.customer-menu__scroll/)
assert.match(customerMenuStyles, /overflow-y: auto/)
assert.match(customerMenuStyles, /overscroll-behavior: contain/)
assert.match(customerMenuStyles, /-webkit-overflow-scrolling: touch/)
assert.match(customerMenuStyles, /touch-action: pan-y/)
assert.match(customerMenuStyles, /height: 100dvh/)
assert.match(customerMenuStyles, /max-height: 100dvh/)

const customerCategoryTabsSource = readFileSync(new URL('../src/components/order/CustomerCategoryTabs.jsx', import.meta.url), 'utf8')
assert.match(customerCategoryTabsSource, /CATEGORY_GROUP_DESCRIPTIONS/)
assert.match(customerCategoryTabsSource, /drink: 'ドリンク分類'/)
assert.match(customerCategoryTabsSource, /food: 'フード分類'/)
assert.match(customerCategoryTabsSource, /customer-category-tabs__button--\$\{category\.group\}/)
assert.match(customerCategoryTabsSource, /customer-category-tabs__marker--\$\{category\.group\}/)
assert.match(customerCategoryTabsSource, /aria-label=\{categoryLabel\}/)
assert.match(customerCategoryTabsSource, /aria-hidden="true"/)
assert.doesNotMatch(customerCategoryTabsSource, /customer-category-tabs__group/)
assert.match(customerMenuStyles, /\.customer-category-tabs__button\.is-active/)
assert.match(customerMenuStyles, /border-radius: 999px/)
assert.match(customerMenuStyles, /\.customer-category-tabs__marker/)
assert.match(customerMenuStyles, /\.customer-category-tabs__marker--drink/)
assert.match(customerMenuStyles, /\.customer-category-tabs__marker--food/)
assert.doesNotMatch(customerMenuStyles, /\.customer-category-tabs__group/)

const customerMenuProductListSource = readFileSync(new URL('../src/components/order/CustomerMenuProductList.jsx', import.meta.url), 'utf8')
assert.match(customerMenuProductListSource, /customerMenuTapToAddEnabled = true/)
assert.match(customerMenuProductListSource, /interactionDisabled = false/)
assert.match(customerMenuProductListSource, /const rowTapEnabled = customerMenuTapToAddEnabled && !product\.isSoldOut && !interactionDisabled/)
assert.match(customerMenuProductListSource, /const ProductMain = rowTapEnabled \? 'button' : 'div'/)
assert.match(customerMenuProductListSource, /onClick: handleRowTap/)
assert.match(customerMenuProductListSource, /'aria-label': tapLabel/)
assert.match(customerMenuProductListSource, /loading="lazy"/)
assert.match(customerMenuProductListSource, /decoding="async"/)
assert.match(customerMenuProductListSource, /simpleItem \? \(/)
assert.match(customerMenuProductListSource, /className="customer-product__add"/)
assert.match(customerMenuProductListSource, /className="customer-product__quantity-value"/)
assert.match(customerMenuProductListSource, /optionItems\.map\(item =>/)
assert.match(customerMenuProductListSource, /formatOptions\(item\.optionSelections\)/)
assert.match(customerMenuProductListSource, /onUpdateQuantity\(item\.id, quantity\)/)
assert.match(customerMenuProductListSource, /customer-product__option-row/)
assert.match(menuPageSource, /onUpdateQuantity=\{updateQuantity\}/)

const customerTopBarSource = readFileSync(new URL('../src/components/order/CustomerTopBar.jsx', import.meta.url), 'utf8')
assert.match(customerTopBarSource, /店員を呼ぶ/)
assert.match(customerTopBarSource, /スタッフを呼びますか？/)
assert.match(customerTopBarSource, /role="dialog"/)

// カートの控え：席の注文ごとに端末へ残し、読み込み直しても消えない。半日たった控えは使わない。
const savedStorage = new Map()
const fakeStorage = { getItem: key => savedStorage.get(key) ?? null, setItem: (key, value) => savedStorage.set(key, value), removeItem: key => savedStorage.delete(key) }
const savedItems = [{ id: 'c1', quantity: 2, optionSelections: [], product: { id: 'p1', name: 'ハイボール', price: 480 } }]
saveCart(cartStorageKey('order-1'), savedItems, fakeStorage, 1000)
assert.equal(loadSavedCart(cartStorageKey('order-1'), fakeStorage, 2000)[0].quantity, 2)
assert.deepEqual(loadSavedCart(cartStorageKey('order-2'), fakeStorage, 2000), [], '別の注文の控えは出さない')
assert.deepEqual(loadSavedCart(cartStorageKey('order-1'), fakeStorage, 1000 + CART_STORAGE_TTL_MS + 1), [])
saveCart(cartStorageKey('order-1'), [], fakeStorage, 3000)
assert.equal(savedStorage.has(cartStorageKey('order-1')), false, '空のカートは控えを消す')
assert.equal(cartStorageKey(''), '')

console.log('customer cart checks passed')
