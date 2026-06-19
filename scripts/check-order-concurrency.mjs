import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildOrderItemCommandDocId } from '../src/lib/orderCommands.js'

function commandError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function normalizeItemStatus(item) {
  return item?.itemStatus ?? 'ordered'
}

function assertOpenOrder(order, { storeId, tableId }) {
  if (!order) throw commandError('order-not-found', 'Order was not found.')
  if (order.storeId !== storeId || order.tableId !== tableId) {
    throw commandError('order-scope-mismatch', 'Order does not match this table.')
  }
  if (order.status !== 'open') throw commandError('order-not-open', 'Order is not open.')
}

function assertCode(errorCode, fn) {
  assert.throws(fn, error => error?.code === errorCode)
}

async function assertSourceContains(file, tokens) {
  const text = await readFile(file, 'utf8')
  for (const token of tokens) {
    assert.ok(text.includes(token), `${file} should contain ${token}`)
  }
}

class MockOrderStore {
  constructor() {
    this.tables = new Map()
    this.orders = new Map()
    this.orderItems = new Map()
    this.checks = new Map()
    this.orderSeq = 0
  }

  addTable(id, data) {
    this.tables.set(id, {
      id,
      status: 'vacant',
      currentOrderId: null,
      guestCount: 0,
      pendingCount: 0,
      ...data,
    })
  }

  nextOrderId() {
    this.orderSeq += 1
    return `order-${this.orderSeq}`
  }

  startOrderSession({ storeId, tableId, guestCount = 1, createdBy = 'customer' }) {
    const table = this.tables.get(tableId)
    if (!table) throw commandError('table-not-found', 'Table was not found.')
    if (table.storeId !== storeId) throw commandError('table-scope-mismatch', 'Table does not match this store.')
    if (table.currentOrderId) return table.currentOrderId
    if (table.status && table.status !== 'vacant') throw commandError('table-not-vacant', 'Table is not vacant.')

    const orderId = this.nextOrderId()
    this.orders.set(orderId, {
      id: orderId,
      storeId,
      tableId,
      guestCount,
      status: 'open',
      createdBy,
    })
    Object.assign(table, {
      status: 'occupied',
      guestCount,
      currentOrderId: orderId,
      pendingCount: 0,
    })
    return orderId
  }

  submitItems({ source, orderId, storeId, tableId, clientRequestId, items }) {
    if (!items?.length) throw commandError('empty-order', 'No order items were provided.')
    const firstItemId = buildOrderItemCommandDocId({ orderId, clientRequestId, index: 0 })
    if (this.orderItems.has(firstItemId)) {
      return { ok: true, deduped: true, clientRequestId }
    }

    const order = this.orders.get(orderId)
    assertOpenOrder(order, { storeId, tableId })

    if (source === 'staff') {
      const table = this.tables.get(tableId)
      if (!table || table.storeId !== storeId || table.currentOrderId !== orderId) {
        throw commandError('table-order-mismatch', 'Table is not linked to this order.')
      }
      table.pendingCount += items.length
    }

    items.forEach((item, index) => {
      const itemId = buildOrderItemCommandDocId({ orderId, clientRequestId, index })
      this.orderItems.set(itemId, {
        id: itemId,
        orderId,
        storeId,
        tableId,
        itemStatus: 'ordered',
        productNameSnapshot: item.name,
        quantity: item.quantity ?? 1,
        orderedBy: source,
        clientRequestId,
      })
    })

    return { ok: true, deduped: false, clientRequestId }
  }

  markServed({ tableId, itemId }) {
    const item = this.getItemForTable(itemId, tableId)
    if (normalizeItemStatus(item) !== 'ordered') return { ok: true, changed: false }
    item.itemStatus = 'served'
    this.addPendingDelta(tableId ?? item.tableId, -1)
    return { ok: true, changed: true }
  }

  markOrdered({ tableId, itemId }) {
    const item = this.getItemForTable(itemId, tableId)
    if (normalizeItemStatus(item) !== 'served') return { ok: true, changed: false }
    item.itemStatus = 'ordered'
    this.addPendingDelta(tableId ?? item.tableId, 1)
    return { ok: true, changed: true }
  }

  cancelItem({ tableId, itemId }) {
    const item = this.getItemForTable(itemId, tableId)
    if (normalizeItemStatus(item) === 'cancelled') return { ok: true, deduped: true }
    const wasOrdered = normalizeItemStatus(item) === 'ordered'
    item.itemStatus = 'cancelled'
    if (wasOrdered) this.addPendingDelta(tableId ?? item.tableId, -1)
    return { ok: true, deduped: false }
  }

  completeCheckout({ storeId, tableId, orderId }) {
    const order = this.orders.get(orderId)
    assertOpenOrder(order, { storeId, tableId })
    const table = this.tables.get(tableId)
    if (!table || table.currentOrderId !== orderId) {
      throw commandError('table-order-mismatch', 'Table is not linked to this order.')
    }
    const checkId = `check_${orderId}`
    this.checks.set(checkId, { id: checkId, storeId, tableId, orderId, status: 'completed' })
    Object.assign(order, { status: 'checked_out', checkoutCheckId: checkId })
    Object.assign(table, {
      status: 'vacant',
      guestCount: 0,
      currentOrderId: null,
      pendingCount: 0,
    })
    return checkId
  }

  moveTable({ sourceTableId, targetTableId, storeId }) {
    const sourceTable = this.tables.get(sourceTableId)
    const targetTable = this.tables.get(targetTableId)
    if (!sourceTable?.currentOrderId) throw commandError('order-not-found', 'No active order is linked.')
    const orderId = sourceTable.currentOrderId
    const order = this.orders.get(orderId)
    if (!targetTable || targetTable.currentOrderId || targetTable.status !== 'vacant') {
      throw commandError('target-table-not-vacant', 'Target table is not vacant.')
    }
    assertOpenOrder(order, { storeId, tableId: sourceTableId })

    const movedItems = [...this.orderItems.values()].filter(item => item.orderId === orderId)
    const pendingCount = movedItems.filter(item => normalizeItemStatus(item) === 'ordered').length
    const guestCount = sourceTable.guestCount ?? 0
    movedItems.forEach(item => {
      item.tableId = targetTableId
    })
    order.tableId = targetTableId
    Object.assign(sourceTable, {
      status: 'vacant',
      currentOrderId: null,
      guestCount: 0,
      pendingCount: 0,
    })
    Object.assign(targetTable, {
      status: 'occupied',
      currentOrderId: orderId,
      guestCount,
      pendingCount,
    })
  }

  getItemForTable(itemId, tableId) {
    const item = this.orderItems.get(itemId)
    if (!item) throw commandError('item-not-found', 'Order item was not found.')
    if (tableId && item.tableId !== tableId) {
      throw commandError('item-table-mismatch', 'Order item is not linked to this table.')
    }
    return item
  }

  addPendingDelta(tableId, delta) {
    const table = this.tables.get(tableId)
    if (table) table.pendingCount += delta
  }
}

function item(name, quantity = 1) {
  return { name, quantity }
}

function runCustomerStartRaceCheck() {
  const store = new MockOrderStore()
  store.addTable('table-1', { storeId: 'store-1' })
  const orderIds = Array.from({ length: 30 }, () => (
    store.startOrderSession({ storeId: 'store-1', tableId: 'table-1', guestCount: 2 })
  ))

  assert.equal(new Set(orderIds).size, 1)
  assert.equal(store.orders.size, 1)
  assert.equal(store.tables.get('table-1').currentOrderId, orderIds[0])
}

function runCustomerRetryDedupCheck() {
  const store = new MockOrderStore()
  store.addTable('table-1', { storeId: 'store-1' })
  const orderId = store.startOrderSession({ storeId: 'store-1', tableId: 'table-1' })
  const request = 'same-customer-request'
  const items = [item('Coffee'), item('Toast')]

  const first = store.submitItems({ source: 'customer', orderId, storeId: 'store-1', tableId: 'table-1', clientRequestId: request, items })
  const retryResults = Array.from({ length: 24 }, () => (
    store.submitItems({ source: 'customer', orderId, storeId: 'store-1', tableId: 'table-1', clientRequestId: request, items })
  ))

  assert.equal(first.deduped, false)
  assert.ok(retryResults.every(result => result.deduped))
  assert.ok(retryResults.length >= 20)
  assert.equal(store.orderItems.size, items.length)
}

function runCustomerDistinctRequestsCheck() {
  const store = new MockOrderStore()
  store.addTable('table-1', { storeId: 'store-1' })
  const orderId = store.startOrderSession({ storeId: 'store-1', tableId: 'table-1' })
  const requestIds = Array.from({ length: 5 }, (_, index) => `customer-request-${index + 1}`)

  requestIds.forEach((clientRequestId, index) => {
    store.submitItems({
      source: 'customer',
      orderId,
      storeId: 'store-1',
      tableId: 'table-1',
      clientRequestId,
      items: [item(`Customer item ${index + 1}`)],
    })
  })

  assert.equal(store.orderItems.size, requestIds.length)
  assert.equal(new Set([...store.orderItems.values()].map(orderItem => orderItem.clientRequestId)).size, requestIds.length)
}

function runCustomerTimeoutRetryCheck() {
  const store = new MockOrderStore()
  store.addTable('table-1', { storeId: 'store-1' })
  const orderId = store.startOrderSession({ storeId: 'store-1', tableId: 'table-1' })
  const request = 'timeout-retry-request'
  const items = [item('Saved before timeout')]

  const first = store.submitItems({ source: 'customer', orderId, storeId: 'store-1', tableId: 'table-1', clientRequestId: request, items })
  const retry = store.submitItems({ source: 'customer', orderId, storeId: 'store-1', tableId: 'table-1', clientRequestId: request, items })

  assert.equal(first.deduped, false)
  assert.equal(retry.deduped, true)
  assert.equal(store.orderItems.size, items.length)
}

function runStaffDoubleTapDedupCheck() {
  const store = new MockOrderStore()
  store.addTable('table-1', { storeId: 'store-1' })
  const orderId = store.startOrderSession({ storeId: 'store-1', tableId: 'table-1', createdBy: 'staff' })
  const request = 'same-staff-request'
  const items = [item('Ramen'), item('Beer'), item('Gyoza')]

  store.submitItems({ source: 'staff', orderId, storeId: 'store-1', tableId: 'table-1', clientRequestId: request, items })
  store.submitItems({ source: 'staff', orderId, storeId: 'store-1', tableId: 'table-1', clientRequestId: request, items })
  store.submitItems({ source: 'staff', orderId, storeId: 'store-1', tableId: 'table-1', clientRequestId: request, items })

  assert.equal(store.orderItems.size, items.length)
  assert.equal(store.tables.get('table-1').pendingCount, items.length)
}

function runItemStatusCounterChecks() {
  const store = new MockOrderStore()
  store.addTable('table-1', { storeId: 'store-1' })
  const orderId = store.startOrderSession({ storeId: 'store-1', tableId: 'table-1', createdBy: 'staff' })
  store.submitItems({
    source: 'staff',
    orderId,
    storeId: 'store-1',
    tableId: 'table-1',
    clientRequestId: 'status-request',
    items: [item('Noodles'), item('Wine'), item('Salad')],
  })

  const [servedItemId, cancelledItemId, servedCancelItemId] = [...store.orderItems.keys()]

  assert.equal(store.tables.get('table-1').pendingCount, 3)
  store.markServed({ tableId: 'table-1', itemId: servedItemId })
  store.markServed({ tableId: 'table-1', itemId: servedItemId })
  assert.equal(store.tables.get('table-1').pendingCount, 2)

  store.markOrdered({ tableId: 'table-1', itemId: servedItemId })
  store.markOrdered({ tableId: 'table-1', itemId: servedItemId })
  assert.equal(store.tables.get('table-1').pendingCount, 3)

  store.cancelItem({ tableId: 'table-1', itemId: cancelledItemId })
  store.cancelItem({ tableId: 'table-1', itemId: cancelledItemId })
  assert.equal(store.tables.get('table-1').pendingCount, 2)

  store.markServed({ tableId: 'table-1', itemId: servedCancelItemId })
  assert.equal(store.tables.get('table-1').pendingCount, 1)
  store.cancelItem({ tableId: 'table-1', itemId: servedCancelItemId })
  assert.equal(store.tables.get('table-1').pendingCount, 1)
}

function runCheckoutLateSubmitCheck() {
  const store = new MockOrderStore()
  store.addTable('table-1', { storeId: 'store-1' })
  const orderId = store.startOrderSession({ storeId: 'store-1', tableId: 'table-1' })
  store.completeCheckout({ storeId: 'store-1', tableId: 'table-1', orderId })

  assertCode('order-not-open', () => {
    store.submitItems({
      source: 'customer',
      orderId,
      storeId: 'store-1',
      tableId: 'table-1',
      clientRequestId: 'late-submit',
      items: [item('Late order')],
    })
  })
}

function runTableMoveConsistencyCheck() {
  const store = new MockOrderStore()
  store.addTable('source-table', { storeId: 'store-1' })
  store.addTable('target-table', { storeId: 'store-1' })
  const orderId = store.startOrderSession({ storeId: 'store-1', tableId: 'source-table', createdBy: 'staff' })
  store.submitItems({
    source: 'staff',
    orderId,
    storeId: 'store-1',
    tableId: 'source-table',
    clientRequestId: 'move-request',
    items: [item('Pizza'), item('Soup'), item('Dessert')],
  })
  const [servedItemId] = [...store.orderItems.keys()]
  store.markServed({ tableId: 'source-table', itemId: servedItemId })
  store.moveTable({ sourceTableId: 'source-table', targetTableId: 'target-table', storeId: 'store-1' })

  assert.equal(store.orders.get(orderId).tableId, 'target-table')
  assert.ok([...store.orderItems.values()].every(orderItem => orderItem.tableId === 'target-table'))
  assert.equal(store.tables.get('source-table').status, 'vacant')
  assert.equal(store.tables.get('source-table').currentOrderId, null)
  assert.equal(store.tables.get('target-table').status, 'occupied')
  assert.equal(store.tables.get('target-table').currentOrderId, orderId)
  assert.equal(store.tables.get('target-table').pendingCount, 2)
}

await Promise.all([
  assertSourceContains('src/services/orderClientCommandService.js', [
    'return runTransaction(db, async transaction =>',
    'if (table.currentOrderId) return table.currentOrderId',
    'if (firstItemSnap.exists()) return { ok: true, deduped: true, clientRequestId }',
    'assertOpenOrder(orderSnap.exists() ? orderSnap.data() : null, { storeId, tableId })',
    'transaction.update(tableRef, { pendingCount: increment(normalizedItems.length), updatedAt: now })',
  ]),
  assertSourceContains('src/services/orderItemCommandService.js', [
    "if (normalizeItemStatus(item) !== 'ordered') return",
    'addTableDelta(tableDeltas, tableId, -1)',
    "if (normalizeItemStatus(item) !== 'served') return { ok: true, changed: false }",
    'pendingCount: increment(1)',
    "if (normalizeItemStatus(item) === 'cancelled')",
    "if (normalizeItemStatus(item) === 'ordered' && resolvedTableId)",
  ]),
  assertSourceContains('src/services/tableMoveCommandService.js', [
    'const pendingCount = movedItems.filter',
    'transaction.update(orderRef, {',
    'transaction.update(sourceTableRef, {',
    'transaction.update(targetTableRef, {',
    'tableId: targetTable.id',
  ]),
])

runCustomerStartRaceCheck()
runCustomerRetryDedupCheck()
runCustomerDistinctRequestsCheck()
runCustomerTimeoutRetryCheck()
runStaffDoubleTapDedupCheck()
runItemStatusCounterChecks()
runCheckoutLateSubmitCheck()
runTableMoveConsistencyCheck()

console.log('order concurrency mock checks passed')
