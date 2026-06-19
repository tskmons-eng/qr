import { getDiscountedProductPrice } from './discounts'
import { ORDER_COMMAND_VERSION } from './orderCommands'

export function commandError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

export function normalizeGuestCount(value) {
  const count = Number(value)
  if (!Number.isFinite(count)) return 1
  return Math.max(1, Math.round(count))
}

export function withCommandFields(payload, { clientRequestId, commandType }) {
  return { ...payload, clientRequestId, orderCommandType: commandType, orderCommandVersion: ORDER_COMMAND_VERSION }
}

export function buildStaffOrderItemPayload({ cartItem, orderId, storeId, tableId, timestamp }) {
  const { product, quantity, optionSelections = [] } = cartItem
  const extra = optionSelections.reduce((sum, option) => sum + (option.extraPrice ?? 0), 0)
  const { originalPrice, discountAmount, discountedPrice } = getDiscountedProductPrice(product)

  return {
    orderId,
    storeId,
    tableId,
    productId: product.id,
    productNameSnapshot: product.name,
    unitPriceSnapshot: originalPrice,
    unitDiscountSnapshot: discountAmount,
    discountConfigSnapshot: product.discountConfig ?? null,
    categoryGroup: product.categoryGroup ?? '',
    quantity,
    lineTotal: (discountedPrice + extra) * quantity,
    orderedBy: 'staff',
    itemStatus: 'ordered',
    optionSelections,
    orderedAt: timestamp,
    updatedAt: timestamp,
  }
}

export function assertOpenOrder(order, { storeId, tableId }) {
  if (!order) throw commandError('order-not-found', 'Order was not found.')
  if (order.storeId !== storeId || order.tableId !== tableId) {
    throw commandError('order-scope-mismatch', 'Order does not match this table.')
  }
  if (order.status !== 'open') throw commandError('order-not-open', 'Order is not open.')
}

export function buildCheckoutCheckPayload({
  storeId,
  tableId,
  orderId,
  guestCount,
  subtotalBeforeItemDiscount,
  itemDiscountAmount,
  activeItemDiscounts,
  subtotal,
  checkoutDiscountAmount,
  totalDiscountAmount,
  discountNote,
  total,
  received,
  change,
  activeStaff,
  timestamp,
}) {
  return withCommandFields({
    storeId,
    tableId,
    orderId,
    guestCount: guestCount ?? 0,
    subtotalBeforeItemDiscount,
    itemDiscountAmount,
    itemDiscounts: activeItemDiscounts,
    subtotal,
    checkoutDiscountAmount,
    discountAmount: totalDiscountAmount,
    discountNote: discountNote?.trim() || null,
    total,
    receivedCash: received,
    changeAmount: change,
    paymentMethod: 'cash',
    status: 'completed',
    closedByStaffId: activeStaff?.id ?? null,
    closedByStaffName: activeStaff?.name ?? null,
    completedAt: timestamp,
    updatedAt: timestamp,
  }, { clientRequestId: `checkout-${orderId}`, commandType: 'complete_checkout' })
}

export function buildCheckoutStaffActionPayload({
  storeId,
  checkId,
  checkoutDiscountAmount,
  itemDiscountAmount,
  total,
  activeStaff,
  timestamp,
}) {
  return {
    storeId,
    actionType: checkoutDiscountAmount > 0 || itemDiscountAmount > 0 ? 'checkout_discount' : 'checkout',
    targetType: 'check',
    targetId: checkId,
    actorType: 'staff',
    actorStaffId: activeStaff?.id ?? null,
    actorStaffName: activeStaff?.name ?? null,
    note: `会計完了 ¥${Number(total ?? 0).toLocaleString()}`,
    createdAt: timestamp,
  }
}
