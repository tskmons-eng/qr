import { collection, doc, getDoc, increment, runTransaction, serverTimestamp } from 'firebase/firestore'
import { buildCustomerOrderItemPayload } from '../lib/customerCart'
import {
  buildCheckoutCommandDocId,
  buildOrderItemCommandDocId,
  ORDER_COMMAND_VERSION,
  normalizeOrderCommandItems,
} from '../lib/orderCommands'
import {
  assertOpenOrder,
  buildCheckoutCheckPayload,
  buildCheckoutStaffActionPayload,
  buildStaffOrderItemPayload,
  commandError,
  normalizeGuestCount,
  withCommandFields,
} from '../lib/orderCommandPayloads'
import { buildEmptyTablePendingAggregateFields } from '../lib/tablePending'
import { db } from '../lib/firebase'

async function loadAutoAddProduct(guestAutoAdd) {
  if (!guestAutoAdd?.enabled || !guestAutoAdd.productId) return null
  const productSnap = await getDoc(doc(db, 'products', guestAutoAdd.productId))
  if (!productSnap.exists()) return null
  const product = { id: productSnap.id, ...productSnap.data() }
  let categoryGroup = product.categoryGroup ?? ''
  if (!categoryGroup && product.categoryId) {
    const categorySnap = await getDoc(doc(db, 'categories', product.categoryId))
    categoryGroup = categorySnap.exists() ? (categorySnap.data().group ?? '') : ''
  }
  return { ...product, categoryGroup, name: product.name ?? guestAutoAdd.productNameSnapshot ?? '' }
}

function itemRefFor({ orderId, clientRequestId, index }) {
  return doc(db, 'orderItems', buildOrderItemCommandDocId({ orderId, clientRequestId, index }))
}

export async function startCustomerOrderSessionClient({ guestAutoAdd, guestCount, storeId, tableId }) {
  const autoAddProduct = await loadAutoAddProduct(guestAutoAdd)
  const tableRef = doc(db, 'tables', tableId)
  const orderRef = doc(collection(db, 'orders'))
  const autoAddRef = autoAddProduct ? doc(collection(db, 'orderItems')) : null
  const now = serverTimestamp()
  const normalizedGuestCount = normalizeGuestCount(guestCount)

  return runTransaction(db, async transaction => {
    const tableSnap = await transaction.get(tableRef)
    if (!tableSnap.exists()) throw commandError('table-not-found', 'Table was not found.')
    const table = tableSnap.data()
    if (table.storeId !== storeId) throw commandError('table-scope-mismatch', 'Table does not match this store.')
    if (table.currentOrderId) return table.currentOrderId
    if (table.status && table.status !== 'vacant') throw commandError('table-not-vacant', 'Table is not vacant.')

    transaction.set(orderRef, {
      storeId,
      tableId,
      guestCount: normalizedGuestCount,
      status: 'open',
      openedAt: now,
      checkedOutAt: null,
      createdBy: 'customer',
      updatedAt: now,
      orderCommandVersion: ORDER_COMMAND_VERSION,
    })
    transaction.update(tableRef, {
      status: 'occupied',
      guestCount: normalizedGuestCount,
      currentOrderId: orderRef.id,
      startedAt: now,
      pendingCount: autoAddProduct ? 1 : 0,
      ...buildEmptyTablePendingAggregateFields(),
      updatedAt: now,
    })
    if (autoAddProduct && autoAddRef) {
      transaction.set(autoAddRef, withCommandFields(buildCustomerOrderItemPayload({
        cartItem: { product: autoAddProduct, quantity: normalizedGuestCount, optionSelections: [] },
        orderId: orderRef.id,
        storeId,
        tableId,
        timestamp: now,
      }), { clientRequestId: `auto-add-${orderRef.id}`, commandType: 'customer_auto_add' }))
    }
    return orderRef.id
  })
}

export async function submitCustomerOrderItemsClient({ items, orderId, storeId, tableId, clientRequestId }) {
  const normalizedItems = normalizeOrderCommandItems(items)
  if (normalizedItems.length === 0) throw commandError('empty-order', 'No order items were provided.')
  const orderRef = doc(db, 'orders', orderId)
  const itemRefs = normalizedItems.map((_, index) => itemRefFor({ orderId, clientRequestId, index }))
  const now = serverTimestamp()

  return runTransaction(db, async transaction => {
    const firstItemSnap = await transaction.get(itemRefs[0])
    const orderSnap = await transaction.get(orderRef)
    if (firstItemSnap.exists()) return { ok: true, deduped: true, clientRequestId }
    assertOpenOrder(orderSnap.exists() ? orderSnap.data() : null, { storeId, tableId })
    normalizedItems.forEach((cartItem, index) => {
      transaction.set(itemRefs[index], withCommandFields(buildCustomerOrderItemPayload({
        cartItem,
        orderId,
        storeId,
        tableId,
        timestamp: now,
      }), { clientRequestId, commandType: 'customer_submit_items' }))
    })
    return { ok: true, deduped: false, clientRequestId }
  })
}

export async function submitStaffOrderItemsClient({ cart, orderId, storeId, tableId, clientRequestId }) {
  const normalizedItems = normalizeOrderCommandItems(cart)
  if (normalizedItems.length === 0) throw commandError('empty-order', 'No order items were provided.')
  const orderRef = doc(db, 'orders', orderId)
  const tableRef = doc(db, 'tables', tableId)
  const itemRefs = normalizedItems.map((_, index) => itemRefFor({ orderId, clientRequestId, index }))
  const now = serverTimestamp()

  return runTransaction(db, async transaction => {
    const firstItemSnap = await transaction.get(itemRefs[0])
    const orderSnap = await transaction.get(orderRef)
    const tableSnap = await transaction.get(tableRef)
    if (firstItemSnap.exists()) return { ok: true, deduped: true, clientRequestId }
    assertOpenOrder(orderSnap.exists() ? orderSnap.data() : null, { storeId, tableId })
    const table = tableSnap.exists() ? tableSnap.data() : null
    if (!table || table.storeId !== storeId || table.currentOrderId !== orderId) {
      throw commandError('table-order-mismatch', 'Table is not linked to this order.')
    }
    normalizedItems.forEach((cartItem, index) => {
      transaction.set(itemRefs[index], withCommandFields(buildStaffOrderItemPayload({
        cartItem,
        orderId,
        storeId,
        tableId,
        timestamp: now,
      }), { clientRequestId, commandType: 'staff_submit_items' }))
    })
    transaction.update(tableRef, { pendingCount: increment(normalizedItems.length), updatedAt: now })
    return { ok: true, deduped: false, clientRequestId }
  })
}

export async function seatStaffOrderSessionClient({ table, tableId, seatCount, activeStaff }) {
  const storeId = table.storeId
  const tableRef = doc(db, 'tables', tableId)
  const orderRef = doc(collection(db, 'orders'))
  const staffActionRef = doc(collection(db, 'staffActions'))
  const now = serverTimestamp()
  const normalizedGuestCount = normalizeGuestCount(seatCount)

  return runTransaction(db, async transaction => {
    const tableSnap = await transaction.get(tableRef)
    if (!tableSnap.exists()) throw commandError('table-not-found', 'Table was not found.')
    const latestTable = tableSnap.data()
    if (latestTable.storeId !== storeId) throw commandError('table-scope-mismatch', 'Table does not match this store.')
    if (latestTable.currentOrderId) return latestTable.currentOrderId
    if (latestTable.status && latestTable.status !== 'vacant') throw commandError('table-not-vacant', 'Table is not vacant.')

    transaction.set(orderRef, {
      storeId,
      tableId,
      guestCount: normalizedGuestCount,
      status: 'open',
      openedAt: now,
      checkedOutAt: null,
      createdBy: 'staff',
      updatedAt: now,
      orderCommandVersion: ORDER_COMMAND_VERSION,
    })
    transaction.update(tableRef, {
      status: 'occupied',
      guestCount: normalizedGuestCount,
      currentOrderId: orderRef.id,
      startedAt: now,
      pendingCount: 0,
      ...buildEmptyTablePendingAggregateFields(),
      updatedAt: now,
    })
    transaction.set(staffActionRef, {
      storeId,
      actionType: 'seat_guests',
      targetType: 'table',
      targetId: tableId,
      actorType: 'staff',
      actorStaffId: activeStaff?.id ?? null,
      actorStaffName: activeStaff?.name ?? null,
      note: `${normalizedGuestCount}名着席`,
      createdAt: now,
    })
    return orderRef.id
  })
}

export async function completeCheckoutClient({
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
}) {
  const orderRef = doc(db, 'orders', orderId)
  const tableRef = doc(db, 'tables', tableId)
  const checkRef = doc(db, 'checks', buildCheckoutCommandDocId({ orderId }))
  const staffActionRef = doc(collection(db, 'staffActions'))
  const now = serverTimestamp()

  return runTransaction(db, async transaction => {
    const checkSnap = await transaction.get(checkRef)
    const orderSnap = await transaction.get(orderRef)
    const tableSnap = await transaction.get(tableRef)

    if (!orderSnap.exists()) throw commandError('order-not-found', 'Order was not found.')
    const order = orderSnap.data()
    if (order.storeId !== storeId || order.tableId !== tableId) {
      throw commandError('order-scope-mismatch', 'Order does not match this table.')
    }
    if (order.status === 'checked_out') {
      const existingCheckId = order.checkoutCheckId ?? (checkSnap.exists() ? checkRef.id : null)
      if (existingCheckId) return existingCheckId
      throw commandError('order-already-checked-out', 'Order is already checked out.')
    }
    if (order.status !== 'open') throw commandError('order-not-open', 'Order is not open.')
    if (checkSnap.exists()) throw commandError('checkout-already-exists', 'Checkout already exists for this order.')

    if (!tableSnap.exists()) throw commandError('table-not-found', 'Table was not found.')
    const table = tableSnap.data()
    if (table.storeId !== storeId || table.currentOrderId !== orderId) {
      throw commandError('table-order-mismatch', 'Table is not linked to this order.')
    }

    transaction.set(checkRef, buildCheckoutCheckPayload({
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
      timestamp: now,
    }))

    transaction.update(orderRef, {
      status: 'checked_out',
      checkedOutAt: now,
      checkoutCheckId: checkRef.id,
      updatedAt: now,
      orderCommandVersion: ORDER_COMMAND_VERSION,
    })

    transaction.update(tableRef, {
      status: 'vacant',
      guestCount: 0,
      currentOrderId: null,
      startedAt: null,
      pendingCount: 0,
      ...buildEmptyTablePendingAggregateFields(),
      updatedAt: now,
    })

    transaction.set(staffActionRef, buildCheckoutStaffActionPayload({
      storeId,
      checkId: checkRef.id,
      checkoutDiscountAmount,
      itemDiscountAmount,
      total,
      activeStaff,
      timestamp: now,
    }))

    return checkRef.id
  })
}
