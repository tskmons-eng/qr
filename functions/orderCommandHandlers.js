const { FieldValue, getFirestore } = require('firebase-admin/firestore')
const {
  ORDER_COMMAND_VERSION,
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
} = require('./orderCommandShared')
const {
  assertOrderItemTargetsAccess,
  assertStoreAccess,
  loadOrderItemForAccess,
  loadTableForAccess,
} = require('./orderCommandAuth')

function itemRefFor(db, { orderId, clientRequestId, index }) {
  return db.collection('orderItems').doc(buildOrderItemCommandDocId({ orderId, clientRequestId, index }))
}

function normalizeItemTargets(items) {
  return Array.isArray(items) ? items.filter(item => item?.id) : []
}

function assertTargetTableMatches(item, requestedTableId) {
  if (requestedTableId && item.tableId && item.tableId !== requestedTableId) {
    throw commandError('item-table-mismatch', 'Order item is not linked to this table.')
  }
}

function buildSeatReservationStaffActionPayload({
  storeId,
  reservation,
  reservationId,
  table,
  guestCount,
  activeStaff,
  timestamp,
}) {
  return {
    storeId,
    actionType: 'seat_reservation',
    targetType: 'reservation',
    targetId: reservationId,
    actorType: 'staff',
    actorStaffId: activeStaff?.id ?? null,
    actorStaffName: activeStaff?.name ?? null,
    note: `${reservation.name ?? '予約'} ${guestCount}名を${table.tableName ?? ''}へ案内`,
    createdAt: timestamp,
  }
}

function addTableDelta(tableDeltas, tableId, delta) {
  if (!tableId || delta === 0) return
  tableDeltas.set(tableId, (tableDeltas.get(tableId) ?? 0) + delta)
}

async function loadProductWithCategoryGroup(db, productId, storeId, fallbackProduct = {}) {
  if (!productId) throw commandError('product-not-found', 'Product was not found.')
  const productSnap = await db.collection('products').doc(productId).get()
  if (!productSnap.exists) throw commandError('product-not-found', 'Product was not found.')
  const product = { id: productSnap.id, ...productSnap.data() }
  if (product.storeId && product.storeId !== storeId) {
    throw commandError('product-scope-mismatch', 'Product does not match this store.')
  }

  let categoryGroup = product.categoryGroup ?? fallbackProduct.categoryGroup ?? ''
  if (!categoryGroup && product.categoryId) {
    const categorySnap = await db.collection('categories').doc(product.categoryId).get()
    if (categorySnap.exists) {
      const category = categorySnap.data()
      if (category.storeId && category.storeId !== storeId) {
        throw commandError('category-scope-mismatch', 'Category does not match this store.')
      }
      categoryGroup = category.group ?? ''
    }
  }

  return {
    ...fallbackProduct,
    ...product,
    categoryGroup,
    name: product.name ?? fallbackProduct.name ?? '',
  }
}

async function normalizeCartItemsWithProducts(db, items, storeId) {
  return Promise.all(items.map(async item => {
    const productId = item?.product?.id ?? item?.productId
    const product = await loadProductWithCategoryGroup(db, productId, storeId, item?.product ?? {})
    return { ...item, product }
  }))
}

async function loadAutoAddProduct(db, guestAutoAdd, storeId) {
  if (!guestAutoAdd?.enabled || !guestAutoAdd.productId) return null
  return loadProductWithCategoryGroup(db, guestAutoAdd.productId, storeId, {
    name: guestAutoAdd.productNameSnapshot ?? '',
  })
}

function isStartSessionContentionError(error) {
  const code = error?.code ?? error?.status ?? error?.details?.code
  return code === 10 ||
    code === 'ABORTED' ||
    code === 'aborted' ||
    /ABORTED|Too much contention/i.test(error?.message ?? '')
}

function waitForStartSessionRetry(attempt) {
  const delayMs = 20 * attempt + Math.floor(Math.random() * 20)
  return new Promise(resolve => {
    setTimeout(resolve, delayMs)
  })
}

async function readExistingCustomerOrderId(tableRef, storeId) {
  const tableSnap = await tableRef.get()
  if (!tableSnap.exists) throw commandError('table-not-found', 'Table was not found.')
  const table = tableSnap.data()
  if (table.storeId !== storeId) throw commandError('table-scope-mismatch', 'Table does not match this store.')
  return table.currentOrderId ?? null
}

async function runCustomerStartTransaction(db, tableRef, storeId, transactionHandler) {
  const maxAttempts = 8
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await db.runTransaction(transactionHandler)
    } catch (error) {
      if (!isStartSessionContentionError(error)) throw error
      const existingOrderId = await readExistingCustomerOrderId(tableRef, storeId)
      if (existingOrderId) return existingOrderId
      if (attempt === maxAttempts) throw error
      await waitForStartSessionRetry(attempt)
    }
  }
  throw commandError('internal', 'Customer order start retry failed.')
}

function normalizeCheckoutMoney(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.round(amount) : 0
}

function normalizeCheckoutItemIds(itemIds) {
  if (!Array.isArray(itemIds)) return null
  return itemIds.map(itemId => String(itemId ?? '').trim()).filter(Boolean).sort()
}

function sameSortedIds(left, right) {
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

function assertCheckoutItemsFresh({
  checkoutItemIds,
  items,
  storeId,
  subtotalBeforeItemDiscount,
  tableId,
}) {
  const activeItems = items.filter(item => normalizeItemStatus(item) !== 'cancelled')
  const scopeMismatch = activeItems.some(item => item.storeId !== storeId || item.tableId !== tableId)
  if (scopeMismatch) {
    throw commandError('checkout-items-stale', 'Checkout items changed. Reload checkout before closing.')
  }

  const checkoutSourceSubtotalBeforeItemDiscount = activeItems.reduce((sum, item) => (
    sum + normalizeCheckoutMoney(item.lineTotal)
  ), 0)
  if (checkoutSourceSubtotalBeforeItemDiscount !== normalizeCheckoutMoney(subtotalBeforeItemDiscount)) {
    throw commandError('checkout-items-stale', 'Checkout items changed. Reload checkout before closing.', {
      checkoutSourceSubtotalBeforeItemDiscount,
      subtotalBeforeItemDiscount: normalizeCheckoutMoney(subtotalBeforeItemDiscount),
    })
  }

  const expectedIds = normalizeCheckoutItemIds(checkoutItemIds)
  const actualIds = activeItems.map(item => item.id).sort()
  if (expectedIds && !sameSortedIds(expectedIds, actualIds)) {
    throw commandError('checkout-items-stale', 'Checkout items changed. Reload checkout before closing.', {
      sourceItemCount: actualIds.length,
      checkoutItemCount: expectedIds.length,
    })
  }

  return {
    checkoutItemCount: actualIds.length,
    checkoutItemIds: actualIds,
    checkoutSourceSubtotalBeforeItemDiscount,
  }
}

async function startCustomerOrderSession({ guestAutoAdd, guestCount, storeId, tableId }) {
  if (!storeId || !tableId) throw commandError('invalid-argument', 'Store and table are required.')
  const db = getFirestore()
  const autoAddProduct = await loadAutoAddProduct(db, guestAutoAdd, storeId)
  const tableRef = db.collection('tables').doc(tableId)
  const orderRef = db.collection('orders').doc()
  const autoAddRef = autoAddProduct ? db.collection('orderItems').doc() : null
  const now = FieldValue.serverTimestamp()
  const normalizedGuestCount = normalizeGuestCount(guestCount)

  return runCustomerStartTransaction(db, tableRef, storeId, async transaction => {
    const tableSnap = await transaction.get(tableRef)
    if (!tableSnap.exists) throw commandError('table-not-found', 'Table was not found.')
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
      orderItemsRevision: autoAddProduct ? 1 : 0,
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

async function submitCustomerOrderItems({ items, orderId, storeId, tableId, clientRequestId }) {
  if (!orderId || !storeId || !tableId) throw commandError('invalid-argument', 'Order, store, and table are required.')
  const db = getFirestore()
  const normalizedItems = normalizeOrderCommandItems(items)
  if (normalizedItems.length === 0) throw commandError('empty-order', 'No order items were provided.')
  const itemsWithProducts = await normalizeCartItemsWithProducts(db, normalizedItems, storeId)
  const requestId = clientRequestId || createOrderCommandRequestId('customer-order')
  const orderRef = db.collection('orders').doc(orderId)
  const itemRefs = itemsWithProducts.map((_, index) => itemRefFor(db, { orderId, clientRequestId: requestId, index }))
  const now = FieldValue.serverTimestamp()

  return db.runTransaction(async transaction => {
    const firstItemSnap = await transaction.get(itemRefs[0])
    const orderSnap = await transaction.get(orderRef)
    if (firstItemSnap.exists) return { ok: true, deduped: true, clientRequestId: requestId }
    assertOpenOrder(orderSnap.exists ? orderSnap.data() : null, { storeId, tableId })
    itemsWithProducts.forEach((cartItem, index) => {
      transaction.set(itemRefs[index], withCommandFields(buildCustomerOrderItemPayload({
        cartItem,
        orderId,
        storeId,
        tableId,
        timestamp: now,
      }), { clientRequestId: requestId, commandType: 'customer_submit_items' }))
    })
    transaction.update(orderRef, {
      orderItemsRevision: FieldValue.increment(1),
      updatedAt: now,
      orderCommandVersion: ORDER_COMMAND_VERSION,
    })
    return { ok: true, deduped: false, clientRequestId: requestId }
  })
}

async function submitStaffOrderItems({ cart, orderId, storeId, tableId, clientRequestId }, request) {
  if (!orderId || !storeId || !tableId) throw commandError('invalid-argument', 'Order, store, and table are required.')
  const db = getFirestore()
  await assertStoreAccess(db, request, storeId)
  const normalizedItems = normalizeOrderCommandItems(cart)
  if (normalizedItems.length === 0) throw commandError('empty-order', 'No order items were provided.')
  const itemsWithProducts = await normalizeCartItemsWithProducts(db, normalizedItems, storeId)
  const requestId = clientRequestId || createOrderCommandRequestId('staff-order')
  const orderRef = db.collection('orders').doc(orderId)
  const tableRef = db.collection('tables').doc(tableId)
  const itemRefs = itemsWithProducts.map((_, index) => itemRefFor(db, { orderId, clientRequestId: requestId, index }))
  const now = FieldValue.serverTimestamp()

  return db.runTransaction(async transaction => {
    const firstItemSnap = await transaction.get(itemRefs[0])
    const orderSnap = await transaction.get(orderRef)
    const tableSnap = await transaction.get(tableRef)
    if (firstItemSnap.exists) return { ok: true, deduped: true, clientRequestId: requestId }
    assertOpenOrder(orderSnap.exists ? orderSnap.data() : null, { storeId, tableId })
    const table = tableSnap.exists ? tableSnap.data() : null
    if (!table || table.storeId !== storeId || table.currentOrderId !== orderId) {
      throw commandError('table-order-mismatch', 'Table is not linked to this order.')
    }
    itemsWithProducts.forEach((cartItem, index) => {
      transaction.set(itemRefs[index], withCommandFields(buildStaffOrderItemPayload({
        cartItem,
        orderId,
        storeId,
        tableId,
        timestamp: now,
      }), { clientRequestId: requestId, commandType: 'staff_submit_items' }))
    })
    transaction.update(tableRef, { pendingCount: FieldValue.increment(itemsWithProducts.length), updatedAt: now })
    transaction.update(orderRef, {
      orderItemsRevision: FieldValue.increment(1),
      updatedAt: now,
      orderCommandVersion: ORDER_COMMAND_VERSION,
    })
    return { ok: true, deduped: false, clientRequestId: requestId }
  })
}

async function seatStaffOrderSession({ tableId, seatCount, activeStaff }, request) {
  if (!tableId) throw commandError('invalid-argument', 'Table is required.')
  const db = getFirestore()
  const table = await loadTableForAccess(db, request, tableId)
  const storeId = table.storeId
  const tableRef = db.collection('tables').doc(tableId)
  const orderRef = db.collection('orders').doc()
  const staffActionRef = db.collection('staffActions').doc()
  const now = FieldValue.serverTimestamp()
  const normalizedGuestCount = normalizeGuestCount(seatCount)

  return db.runTransaction(async transaction => {
    const tableSnap = await transaction.get(tableRef)
    if (!tableSnap.exists) throw commandError('table-not-found', 'Table was not found.')
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
      orderItemsRevision: 0,
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

async function completeCheckoutCommand(data, request) {
  const {
    storeId,
    tableId,
    orderId,
    checkoutDiscountAmount,
    itemDiscountAmount,
    checkoutItemIds,
    orderItemsRevision,
    total,
    activeStaff,
  } = data
  if (!storeId || !tableId || !orderId) throw commandError('invalid-argument', 'Order, store, and table are required.')
  const db = getFirestore()
  await assertStoreAccess(db, request, storeId)
  const orderRef = db.collection('orders').doc(orderId)
  const tableRef = db.collection('tables').doc(tableId)
  const checkRef = db.collection('checks').doc(buildCheckoutCommandDocId({ orderId }))
  const staffActionRef = db.collection('staffActions').doc()
  const now = FieldValue.serverTimestamp()

  return db.runTransaction(async transaction => {
    const checkSnap = await transaction.get(checkRef)
    const orderSnap = await transaction.get(orderRef)
    const tableSnap = await transaction.get(tableRef)
    const orderItemsSnap = await transaction.get(db.collection('orderItems').where('orderId', '==', orderId))

    if (!orderSnap.exists) throw commandError('order-not-found', 'Order was not found.')
    const order = orderSnap.data()
    if (order.storeId !== storeId || order.tableId !== tableId) {
      throw commandError('order-scope-mismatch', 'Order does not match this table.')
    }
    if (order.status === 'checked_out') {
      const existingCheckId = order.checkoutCheckId ?? (checkSnap.exists ? checkRef.id : null)
      if (existingCheckId) return existingCheckId
      throw commandError('order-already-checked-out', 'Order is already checked out.')
    }
    if (order.status !== 'open') throw commandError('order-not-open', 'Order is not open.')
    if (checkSnap.exists) throw commandError('checkout-already-exists', 'Checkout already exists for this order.')
    if (Number.isFinite(Number(orderItemsRevision)) && Number(order.orderItemsRevision ?? 0) !== Number(orderItemsRevision)) {
      throw commandError('checkout-items-stale', 'Checkout items changed. Reload checkout before closing.', {
        sourceOrderItemsRevision: Number(order.orderItemsRevision ?? 0),
        checkoutOrderItemsRevision: Number(orderItemsRevision),
      })
    }

    if (!tableSnap.exists) throw commandError('table-not-found', 'Table was not found.')
    const table = tableSnap.data()
    if (table.storeId !== storeId || table.currentOrderId !== orderId) {
      throw commandError('table-order-mismatch', 'Table is not linked to this order.')
    }
    const checkoutSnapshot = assertCheckoutItemsFresh({
      checkoutItemIds,
      items: orderItemsSnap.docs.map(itemDoc => ({ id: itemDoc.id, ...itemDoc.data() })),
      storeId,
      subtotalBeforeItemDiscount: data.subtotalBeforeItemDiscount,
      tableId,
    })

    transaction.set(checkRef, buildCheckoutCheckPayload({
      ...data,
      ...checkoutSnapshot,
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

async function updateItemsToServed(db, targets) {
  const now = FieldValue.serverTimestamp()

  return db.runTransaction(async transaction => {
    const itemRows = []
    for (const target of targets) {
      const itemRef = db.collection('orderItems').doc(target.id)
      const itemSnap = await transaction.get(itemRef)
      if (!itemSnap.exists) throw commandError('item-not-found', 'Order item was not found.')
      const item = { id: itemSnap.id, ...itemSnap.data() }
      assertTargetTableMatches(item, target.tableId)
      itemRows.push({ itemRef, item, tableId: target.tableId ?? item.tableId ?? null })
    }

    const tableDeltas = new Map()
    itemRows.forEach(({ itemRef, item, tableId }) => {
      if (normalizeItemStatus(item) !== 'ordered') return
      transaction.update(itemRef, {
        itemStatus: 'served',
        updatedAt: now,
        orderCommandVersion: ORDER_COMMAND_VERSION,
      })
      addTableDelta(tableDeltas, tableId, -1)
    })

    tableDeltas.forEach((delta, tableId) => {
      transaction.update(db.collection('tables').doc(tableId), {
        pendingCount: FieldValue.increment(delta),
        updatedAt: now,
      })
    })

    return { ok: true, changed: itemRows.length }
  })
}

async function markOrderItemServedCommand({ tableId, itemId }, request) {
  const db = getFirestore()
  const targets = [{ id: itemId, tableId }]
  await assertOrderItemTargetsAccess(db, request, targets)
  return updateItemsToServed(db, targets)
}

async function markOrderItemsServedCommand({ items }, request) {
  const db = getFirestore()
  const targets = normalizeItemTargets(items)
  await assertOrderItemTargetsAccess(db, request, targets)
  return updateItemsToServed(db, targets)
}

async function markOrderItemOrderedCommand({ tableId, itemId }, request) {
  const db = getFirestore()
  await loadOrderItemForAccess(db, request, itemId)
  const itemRef = db.collection('orderItems').doc(itemId)
  const now = FieldValue.serverTimestamp()

  return db.runTransaction(async transaction => {
    const itemSnap = await transaction.get(itemRef)
    if (!itemSnap.exists) throw commandError('item-not-found', 'Order item was not found.')
    const item = { id: itemSnap.id, ...itemSnap.data() }
    assertTargetTableMatches(item, tableId)
    if (normalizeItemStatus(item) !== 'served') return { ok: true, changed: false }

    transaction.update(itemRef, {
      itemStatus: 'ordered',
      updatedAt: now,
      orderCommandVersion: ORDER_COMMAND_VERSION,
    })
    const resolvedTableId = tableId ?? item.tableId ?? null
    if (resolvedTableId) {
      transaction.update(db.collection('tables').doc(resolvedTableId), {
        pendingCount: FieldValue.increment(1),
        updatedAt: now,
      })
    }
    return { ok: true, changed: true }
  })
}

async function cancelOrderItemCommand(data, request) {
  const {
    itemId,
    tableId,
    tableName,
    source,
    activeStaff,
  } = data
  const db = getFirestore()
  await loadOrderItemForAccess(db, request, itemId)
  const itemRef = db.collection('orderItems').doc(itemId)
  const staffActionRef = db.collection('staffActions').doc()
  const now = FieldValue.serverTimestamp()

  return db.runTransaction(async transaction => {
    const itemSnap = await transaction.get(itemRef)
    if (!itemSnap.exists) throw commandError('item-not-found', 'Order item was not found.')
    const item = { id: itemSnap.id, ...itemSnap.data() }
    assertTargetTableMatches(item, tableId)

    if (normalizeItemStatus(item) === 'cancelled') {
      return { ok: true, deduped: true }
    }

    const resolvedTableId = tableId ?? item.tableId ?? null
    transaction.update(itemRef, {
      itemStatus: 'cancelled',
      updatedAt: now,
      orderCommandVersion: ORDER_COMMAND_VERSION,
    })
    if (normalizeItemStatus(item) === 'ordered' && resolvedTableId) {
      transaction.update(db.collection('tables').doc(resolvedTableId), {
        pendingCount: FieldValue.increment(-1),
        updatedAt: now,
      })
    }
    transaction.set(staffActionRef, buildCancelItemStaffActionPayload({
      storeId: item.storeId,
      itemId,
      item,
      tableName,
      source,
      activeStaff,
      actorUid: request.auth?.uid ?? null,
      timestamp: now,
    }))

    return { ok: true, deduped: false }
  })
}

async function moveTableOrderCommand({ sourceTableId, targetTable, activeStaff }, request) {
  if (!sourceTableId || !targetTable?.id) throw commandError('invalid-argument', 'Source and target tables are required.')
  const db = getFirestore()
  const sourcePreview = await loadTableForAccess(db, request, sourceTableId)
  const orderId = sourcePreview.currentOrderId
  if (!orderId) throw commandError('order-not-found', 'No active order is linked to the source table.')

  const sourceTableRef = db.collection('tables').doc(sourceTableId)
  const targetTableRef = db.collection('tables').doc(targetTable.id)
  const orderRef = db.collection('orders').doc(orderId)
  const staffActionRef = db.collection('staffActions').doc()
  const now = FieldValue.serverTimestamp()

  return db.runTransaction(async transaction => {
    const sourceSnap = await transaction.get(sourceTableRef)
    const targetSnap = await transaction.get(targetTableRef)
    const orderSnap = await transaction.get(orderRef)
    const itemSnap = await transaction.get(db.collection('orderItems').where('orderId', '==', orderId))
    const itemRows = itemSnap.docs.map(itemDoc => ({ itemRef: itemDoc.ref, item: itemDoc.data() }))

    if (!sourceSnap.exists) throw commandError('source-table-not-found', 'Source table was not found.')
    if (!targetSnap.exists) throw commandError('target-table-not-found', 'Target table was not found.')
    if (!orderSnap.exists) throw commandError('order-not-found', 'Order was not found.')

    const latestSource = { id: sourceSnap.id, ...sourceSnap.data() }
    const latestTarget = { id: targetSnap.id, ...targetSnap.data() }
    const order = orderSnap.data()
    if (latestSource.storeId !== sourcePreview.storeId || latestTarget.storeId !== sourcePreview.storeId) {
      throw commandError('table-scope-mismatch', 'Tables do not match this store.')
    }
    if (latestSource.currentOrderId !== orderId) {
      throw commandError('source-order-mismatch', 'Source table is no longer linked to this order.')
    }
    if (latestTarget.currentOrderId || (latestTarget.status && latestTarget.status !== 'vacant')) {
      throw commandError('target-table-not-vacant', 'Target table is not vacant.')
    }
    if (order.storeId !== sourcePreview.storeId || order.tableId !== sourceTableId || order.status !== 'open') {
      throw commandError('order-scope-mismatch', 'Order does not match the source table.')
    }

    const movedItems = itemRows.filter(({ item }) => item.orderId === orderId)
    const pendingCount = movedItems.filter(({ item }) => normalizeItemStatus(item) === 'ordered').length

    movedItems.forEach(({ itemRef }) => {
      transaction.update(itemRef, {
        tableId: targetTable.id,
        updatedAt: now,
        orderCommandVersion: ORDER_COMMAND_VERSION,
      })
    })
    transaction.update(orderRef, {
      tableId: targetTable.id,
      updatedAt: now,
      orderCommandVersion: ORDER_COMMAND_VERSION,
    })
    transaction.update(sourceTableRef, {
      status: 'vacant',
      currentOrderId: null,
      guestCount: 0,
      startedAt: null,
      pendingCount: 0,
      updatedAt: now,
    })
    transaction.update(targetTableRef, {
      status: 'occupied',
      currentOrderId: orderId,
      guestCount: latestSource.guestCount ?? 0,
      startedAt: latestSource.startedAt ?? null,
      pendingCount,
      updatedAt: now,
    })
    transaction.set(staffActionRef, buildMoveTableStaffActionPayload({
      storeId: sourcePreview.storeId,
      sourceTable: latestSource,
      targetTable: latestTarget,
      activeStaff,
      timestamp: now,
    }))

    return { ok: true }
  })
}

async function guideReservationToTableCommand({ reservationId, targetTableId, activeStaff, storeId }, request) {
  if (!reservationId || !targetTableId) {
    throw commandError('invalid-argument', 'Reservation and target table are required.')
  }

  const db = getFirestore()
  const reservationRef = db.collection('reservations').doc(reservationId)
  const tableRef = db.collection('tables').doc(targetTableId)
  const reservationPreviewSnap = await reservationRef.get()
  if (!reservationPreviewSnap.exists) return { ok: false, reason: 'reservation-missing' }
  const reservationPreview = reservationPreviewSnap.data()
  if (storeId && reservationPreview.storeId !== storeId) {
    return { ok: false, reason: 'store-mismatch' }
  }
  await assertStoreAccess(db, request, reservationPreview.storeId)

  return db.runTransaction(async transaction => {
    const reservationSnap = await transaction.get(reservationRef)
    const tableSnap = await transaction.get(tableRef)

    if (!reservationSnap.exists) return { ok: false, reason: 'reservation-missing' }
    if (!tableSnap.exists) return { ok: false, reason: 'table-missing' }

    const reservation = reservationSnap.data()
    const table = tableSnap.data()
    if (reservation.storeId !== reservationPreview.storeId) {
      throw commandError('reservation-store-mismatch', 'Reservation store changed during command.')
    }
    if (storeId && reservation.storeId !== storeId) return { ok: false, reason: 'store-mismatch' }
    if (reservation.storeId !== table.storeId) return { ok: false, reason: 'store-mismatch' }
    if (reservation.status !== 'confirmed') return { ok: false, reason: 'reservation-closed' }

    const now = FieldValue.serverTimestamp()
    const guestCount = normalizeGuestCount(reservation.guestCount)
    const actorFields = {
      handledByStaffId: activeStaff?.id ?? null,
      handledByStaffName: activeStaff?.name ?? null,
    }
    let orderId = table.currentOrderId ?? null
    const isVacant = table.status === 'vacant' || !table.currentOrderId

    if (isVacant) {
      const orderRef = db.collection('orders').doc()
      orderId = orderRef.id
      transaction.set(orderRef, {
        storeId: reservation.storeId,
        tableId: targetTableId,
        guestCount,
        status: 'open',
        openedAt: now,
        checkedOutAt: null,
        createdBy: 'reservation',
        reservationId,
        orderItemsRevision: 0,
        updatedAt: now,
        orderCommandVersion: ORDER_COMMAND_VERSION,
      })
      transaction.update(tableRef, {
        status: 'occupied',
        guestCount,
        currentOrderId: orderId,
        startedAt: now,
        pendingCount: 0,
        ...buildEmptyTablePendingAggregateFields(),
        updatedAt: now,
      })
    } else if (orderId) {
      transaction.update(db.collection('orders').doc(orderId), {
        guestCount,
        reservationId,
        updatedAt: now,
        orderCommandVersion: ORDER_COMMAND_VERSION,
      })
      transaction.update(tableRef, {
        guestCount,
        updatedAt: now,
      })
    }

    transaction.update(reservationRef, {
      status: 'seated',
      waitingStatus: 'handled',
      waitingReason: null,
      seatedTableId: targetTableId,
      seatedOrderId: orderId,
      handledAt: now,
      ...actorFields,
      updatedAt: now,
    })

    transaction.set(db.collection('staffActions').doc(), buildSeatReservationStaffActionPayload({
      storeId: reservation.storeId,
      reservation,
      reservationId,
      table,
      guestCount,
      activeStaff,
      timestamp: now,
    }))

    return { ok: true, orderId, wasOccupied: !isVacant }
  })
}

module.exports = {
  cancelOrderItemCommand,
  completeCheckoutCommand,
  guideReservationToTableCommand,
  markOrderItemOrderedCommand,
  markOrderItemServedCommand,
  markOrderItemsServedCommand,
  moveTableOrderCommand,
  seatStaffOrderSession,
  startCustomerOrderSession,
  submitCustomerOrderItems,
  submitStaffOrderItems,
}
