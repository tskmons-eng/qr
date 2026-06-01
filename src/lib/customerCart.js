import { getDiscountedProductPrice } from './discounts.js'

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
