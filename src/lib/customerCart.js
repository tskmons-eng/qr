import { normalizeCustomerSubmitRecoveryItems } from './customerSubmitRecovery.js'
import { getDiscountedProductPrice } from './discounts.js'

// カートの控え（2026-10-28 注文の流れ 第2章）。席の注文ごとに端末へ残す。半日たった控えは使わない。
export const CART_STORAGE_TTL_MS = 12 * 60 * 60 * 1000

export function cartStorageKey(orderId) {
  return orderId ? `qr.cart.v1.${orderId}` : ''
}

function cartStorage() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function loadSavedCart(key, storage = cartStorage(), now = Date.now()) {
  try {
    const saved = JSON.parse(storage?.getItem(key) ?? 'null')
    if (!saved || now - Number(saved.savedAt ?? 0) > CART_STORAGE_TTL_MS) return []
    return normalizeCustomerSubmitRecoveryItems(saved.items)
  } catch {
    return []
  }
}

export function saveCart(key, items, storage = cartStorage(), now = Date.now()) {
  try {
    if (items.length === 0) storage?.removeItem(key)
    else storage?.setItem(key, JSON.stringify({ savedAt: now, items }))
  } catch {
    // 控えられなくても注文はできる（プライベートブラウズなど）。
  }
}

export function formatCartOptions(optionSelections) {
  if (!optionSelections || optionSelections.length === 0) return null
  return optionSelections.map(option => option.choice).join(' · ')
}

export function normalizeCartQuantity(value) {
  const quantity = parseInt(value, 10)
  if (Number.isNaN(quantity)) return 0
  return Math.min(99, Math.max(0, quantity))
}

export function calculateCartItemPricing({ product, optionSelections = [], quantity }) {
  const optionExtra = optionSelections.reduce((sum, option) => sum + (option.extraPrice ?? 0), 0)
  const { originalPrice, discountAmount, discountedPrice } = getDiscountedProductPrice(product)
  const unitPrice = discountedPrice + optionExtra

  return {
    optionExtra,
    originalPrice,
    discountAmount,
    discountedPrice,
    unitPrice,
    regularUnitPrice: originalPrice + optionExtra,
    lineTotal: unitPrice * quantity,
  }
}

export function buildCustomerOrderItemPayload({ cartItem, orderId, storeId, tableId, timestamp }) {
  const { product, quantity, optionSelections = [] } = cartItem
  const pricing = calculateCartItemPricing({ product, optionSelections, quantity })

  return {
    orderId,
    storeId,
    tableId,
    productId: product.id,
    productNameSnapshot: product.name,
    unitPriceSnapshot: pricing.originalPrice,
    unitDiscountSnapshot: pricing.discountAmount,
    discountConfigSnapshot: product.discountConfig ?? null,
    categoryGroup: product.categoryGroup ?? '',
    quantity,
    lineTotal: pricing.lineTotal,
    orderedBy: 'customer',
    itemStatus: 'ordered',
    optionSelections,
    orderedAt: timestamp,
    updatedAt: timestamp,
  }
}
