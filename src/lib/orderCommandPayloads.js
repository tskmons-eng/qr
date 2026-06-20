import { getDiscountedProductPrice } from './discounts'
import { ORDER_COMMAND_VERSION } from './orderCommands'

export function commandError(code, message, context = {}) {
  const error = new Error(message)
  error.code = code
  if (context && Object.keys(context).length > 0) {
    error.orderCommandContext = context
  }
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

export function buildStaffOrderItemPayload({ activeStaff, cartItem, orderId, storeId, tableId, timestamp }) {
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
    orderedByStaffId: activeStaff?.id ?? null,
    orderedByStaffName: activeStaff?.name ?? null,
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
  checkoutItemCount,
  checkoutItemIds,
  checkoutSourceSubtotalBeforeItemDiscount,
  orderItemsRevision,
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
    checkoutSourceSubtotalBeforeItemDiscount,
    checkoutOrderItemsRevision: Number.isFinite(Number(orderItemsRevision)) ? Number(orderItemsRevision) : null,
    itemDiscountAmount,
    itemDiscounts: activeItemDiscounts,
    checkoutItemCount: checkoutItemCount ?? 0,
    checkoutItemIds: Array.isArray(checkoutItemIds) ? checkoutItemIds : [],
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

export function buildCancelItemStaffActionPayload({
  storeId,
  itemId,
  item,
  tableName,
  source = 'staff_table',
  activeStaff,
  actorUid,
  timestamp,
}) {
  const itemName = item?.productNameSnapshot ?? '商品'
  const quantity = item?.quantity ?? 0
  const note = source === 'kitchen'
    ? `${tableName ?? ''} ${itemName} x${quantity} を削除`
    : `${itemName} × ${quantity} をキャンセル`

  return {
    storeId,
    actionType: 'cancel_item',
    targetType: 'orderItem',
    targetId: itemId,
    actorType: 'staff',
    actorStaffId: activeStaff?.id ?? null,
    actorStaffName: activeStaff?.name ?? null,
    actorUid: actorUid ?? null,
    note,
    createdAt: timestamp,
  }
}

export function buildMoveTableStaffActionPayload({
  storeId,
  sourceTable,
  targetTable,
  activeStaff,
  timestamp,
}) {
  return {
    storeId,
    actionType: 'move_table',
    targetType: 'table',
    targetId: targetTable.id,
    actorType: 'staff',
    actorStaffId: activeStaff?.id ?? null,
    actorStaffName: activeStaff?.name ?? null,
    note: `${sourceTable.tableName} → ${targetTable.tableName} に移動`,
    createdAt: timestamp,
  }
}
