const { randomUUID } = require('node:crypto')

const ORDER_COMMAND_VERSION = 1
const TABLE_PENDING_AGGREGATE_VERSION = 1

function commandError(code, message, context = {}) {
  const error = new Error(message)
  error.code = code
  if (context && Object.keys(context).length > 0) {
    error.orderCommandContext = context
  }
  return error
}

function normalizeGuestCount(value) {
  const count = Number(value)
  if (!Number.isFinite(count)) return 1
  return Math.max(1, Math.round(count))
}

function normalizeOrderQuantity(value) {
  const quantity = Number(value)
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw commandError('invalid-quantity', 'Order item quantity must be greater than zero.')
  }
  return Math.min(99, Math.round(quantity))
}

function normalizeOrderCommandSegment(value, fallback = 'unknown') {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 96)

  return normalized || fallback
}

function createOrderCommandRequestId(prefix = 'order-command') {
  return `${prefix}_${randomUUID()}`
}

function buildOrderItemCommandDocId({ orderId, clientRequestId, index }) {
  const orderSegment = normalizeOrderCommandSegment(orderId, 'order')
  const requestSegment = normalizeOrderCommandSegment(clientRequestId, 'request')
  const lineSegment = String(index).padStart(3, '0')
  return `oi_${orderSegment}_${requestSegment}_${lineSegment}`
}

function buildCheckoutCommandDocId({ orderId }) {
  const orderSegment = normalizeOrderCommandSegment(orderId, 'order')
  return `check_${orderSegment}`
}

function normalizeOrderCommandItems(items) {
  return Array.isArray(items) ? items.filter(Boolean) : []
}

function buildEmptyTablePendingAggregateFields() {
  return {
    pendingAggregateVersion: TABLE_PENDING_AGGREGATE_VERSION,
    pendingAggregateCount: 0,
    pendingAggregateDrinkCount: 0,
    pendingAggregateFoodCount: 0,
  }
}

function getTokyoDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function getTokyoWeekday(date = new Date()) {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    weekday: 'short',
  }).format(date)
  const index = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday)
  return index >= 0 ? index : date.getDay()
}

function isDiscountActive(discountConfig, date = new Date()) {
  if (!discountConfig?.enabled) return false
  const today = getTokyoDateKey(date)
  if (discountConfig.startDate && today < discountConfig.startDate) return false
  if (discountConfig.endDate && today > discountConfig.endDate) return false
  const weekdays = discountConfig.weekdays ?? []
  if (weekdays.length > 0 && !weekdays.includes(getTokyoWeekday(date))) return false
  return true
}

function calculateDiscountAmount(price, discountConfig, date = new Date()) {
  if (!isDiscountActive(discountConfig, date)) return 0
  const value = Number(discountConfig.value) || 0
  if (value <= 0) return 0
  if (discountConfig.type === 'percent') {
    return Math.min(price, Math.floor(price * Math.min(value, 100) / 100))
  }
  return Math.min(price, value)
}

function getDiscountedProductPrice(product, date = new Date()) {
  const price = Number(product?.price) || 0
  const discountAmount = calculateDiscountAmount(price, product?.discountConfig, date)
  return {
    originalPrice: price,
    discountAmount,
    discountedPrice: price - discountAmount,
  }
}

function normalizeOptionSelections(optionSelections) {
  return Array.isArray(optionSelections) ? optionSelections : []
}

function calculateOrderItemPricing({ product, optionSelections = [], quantity }) {
  const optionExtra = optionSelections.reduce((sum, option) => sum + (Number(option?.extraPrice) || 0), 0)
  const { originalPrice, discountAmount, discountedPrice } = getDiscountedProductPrice(product)
  const unitPrice = discountedPrice + optionExtra

  return {
    originalPrice,
    discountAmount,
    lineTotal: unitPrice * quantity,
  }
}

function withCommandFields(payload, { clientRequestId, commandType }) {
  return {
    ...payload,
    clientRequestId,
    orderCommandType: commandType,
    orderCommandVersion: ORDER_COMMAND_VERSION,
  }
}

function buildBaseOrderItemPayload({ cartItem, orderedBy, orderId, storeId, tableId, timestamp }) {
  const { product } = cartItem
  const quantity = normalizeOrderQuantity(cartItem.quantity)
  const optionSelections = normalizeOptionSelections(cartItem.optionSelections)
  const pricing = calculateOrderItemPricing({ product, optionSelections, quantity })

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
    orderedBy,
    itemStatus: 'ordered',
    optionSelections,
    orderedAt: timestamp,
    updatedAt: timestamp,
  }
}

function buildCustomerOrderItemPayload({ cartItem, orderId, storeId, tableId, timestamp }) {
  return buildBaseOrderItemPayload({
    cartItem,
    orderedBy: 'customer',
    orderId,
    storeId,
    tableId,
    timestamp,
  })
}

function buildStaffOrderItemPayload({ cartItem, orderId, storeId, tableId, timestamp }) {
  return buildBaseOrderItemPayload({
    cartItem,
    orderedBy: 'staff',
    orderId,
    storeId,
    tableId,
    timestamp,
  })
}

function assertOpenOrder(order, { storeId, tableId }) {
  if (!order) throw commandError('order-not-found', 'Order was not found.')
  if (order.storeId !== storeId || order.tableId !== tableId) {
    throw commandError('order-scope-mismatch', 'Order does not match this table.')
  }
  if (order.status !== 'open') throw commandError('order-not-open', 'Order is not open.')
}

function buildCheckoutCheckPayload({
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

function buildCheckoutStaffActionPayload({
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

function buildCancelItemStaffActionPayload({
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

function buildMoveTableStaffActionPayload({
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

function normalizeItemStatus(item) {
  return item?.itemStatus ?? 'ordered'
}

module.exports = {
  ORDER_COMMAND_VERSION,
  TABLE_PENDING_AGGREGATE_VERSION,
  assertOpenOrder,
  buildCancelItemStaffActionPayload,
  buildCheckoutCheckPayload,
  buildCheckoutCommandDocId,
  buildCheckoutStaffActionPayload,
  buildCustomerOrderItemPayload,
  buildEmptyTablePendingAggregateFields,
  buildMoveTableStaffActionPayload,
  buildOrderItemCommandDocId,
  buildStaffOrderItemPayload,
  commandError,
  createOrderCommandRequestId,
  normalizeGuestCount,
  normalizeItemStatus,
  normalizeOrderCommandItems,
  withCommandFields,
}
