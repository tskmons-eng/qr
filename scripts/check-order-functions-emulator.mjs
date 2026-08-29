import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth'
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions'

const PROJECT_ID = 'demo-qr-functions-concurrency'
const FUNCTIONS_HOST = '127.0.0.1'
const FUNCTIONS_PORT = 5001
const ASIA_FUNCTIONS_REGION = 'asia-northeast1'
const AUTH_HOST = '127.0.0.1'
const AUTH_PORT = 9099
const INSIDE_ENV = 'QR_ORDER_FUNCTIONS_EMULATOR_INSIDE'
const EXPECTED_NODE_MAJOR_ENV = 'QR_EXPECT_NODE_MAJOR'
const JAVA_EXE = process.platform === 'win32' ? 'java.exe' : 'java'

if (process.env[EXPECTED_NODE_MAJOR_ENV]) {
  assert.equal(
    process.versions.node.split('.')[0],
    process.env[EXPECTED_NODE_MAJOR_ENV],
    `Functions Emulator check should execute on Node.js ${process.env[EXPECTED_NODE_MAJOR_ENV]}`,
  )
}

function javaMajorVersion(javaBin) {
  const javaPath = join(javaBin, JAVA_EXE)
  if (!existsSync(javaPath)) return 0
  const result = spawnSync(javaPath, ['-version'], { encoding: 'utf8' })
  if (result.error) return 0
  const output = `${result.stderr ?? ''}\n${result.stdout ?? ''}`
  const match = output.match(/version "(\d+)(?:\.(\d+))?/)
  if (!match) return 0
  return Number(match[1] === '1' ? match[2] : match[1])
}

function chooseJavaBin(candidates) {
  const scored = candidates
    .map(bin => ({ bin, version: javaMajorVersion(bin) }))
    .filter(candidate => candidate.version > 0)
    .sort((left, right) => right.version - left.version)
  return scored.find(candidate => candidate.version >= 21)?.bin ?? scored[0]?.bin ?? null
}

function findJavaBin() {
  const candidates = []
  if (process.env.JAVA_HOME) {
    const javaHomeBin = join(process.env.JAVA_HOME, 'bin')
    if (existsSync(join(javaHomeBin, JAVA_EXE))) candidates.push(javaHomeBin)
  }
  if (process.platform !== 'win32') return chooseJavaBin(candidates)

  const roots = [
    process.env.ProgramFiles ? join(process.env.ProgramFiles, 'Eclipse Adoptium') : null,
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Programs', 'Microsoft') : null,
    process.env.ProgramFiles ? join(process.env.ProgramFiles, 'Microsoft') : null,
    process.env.ProgramFiles ? join(process.env.ProgramFiles, 'Java') : null,
  ].filter(Boolean)

  for (const root of roots) {
    if (!existsSync(root)) continue
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/(jdk|jre|java|openjdk)/i.test(entry.name)) continue
      const bin = join(root, entry.name, 'bin')
      if (existsSync(join(bin, JAVA_EXE))) candidates.push(bin)
    }
  }
  return chooseJavaBin(candidates)
}

function runInsideEmulator() {
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npx'
  const javaBin = findJavaBin()
  const pathWithJava = javaBin ? `${javaBin}${delimiter}${process.env.PATH ?? ''}` : process.env.PATH
  let tempDir = null
  let scriptCommand = 'node scripts/check-order-functions-emulator.mjs'
  if (process.platform === 'win32') {
    tempDir = mkdtempSync(join(tmpdir(), 'qr-order-functions-emulator-'))
    const cmdPath = join(tempDir, 'run.cmd')
    writeFileSync(cmdPath, `@echo off\r\n"${process.execPath}" "${fileURLToPath(import.meta.url)}"\r\n`)
    scriptCommand = cmdPath
  }
  const args = process.platform === 'win32'
    ? [
        '/d',
        '/c',
        `npx --yes firebase-tools --project ${PROJECT_ID} emulators:exec --only firestore,functions,auth ${scriptCommand}`,
      ]
    : [
        '--yes',
        'firebase-tools',
        '--project',
        PROJECT_ID,
        'emulators:exec',
        '--only',
        'firestore,functions,auth',
        'node scripts/check-order-functions-emulator.mjs',
      ]
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      GCLOUD_PROJECT: PROJECT_ID,
      PATH: pathWithJava,
      [INSIDE_ENV]: '1',
    },
    stdio: 'inherit',
  })

  if (tempDir) rmSync(tempDir, { recursive: true, force: true })
  if (result.error) throw result.error
  process.exit(result.status ?? 1)
}

if (process.env[INSIDE_ENV] !== '1') {
  runInsideEmulator()
}

const functionsRequire = createRequire(new URL('../functions/package.json', import.meta.url))
const { initializeApp: initializeAdminApp, getApps } = functionsRequire('firebase-admin/app')
const { getFirestore, FieldValue } = functionsRequire('firebase-admin/firestore')

process.env.GCLOUD_PROJECT = PROJECT_ID
process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= `${AUTH_HOST}:${AUTH_PORT}`

const runId = `emu_${Date.now()}`
const storeId = `${runId}_store`
const otherStoreId = `${runId}_other_store`
const staff = { id: `${runId}_staff`, name: 'Emulator Staff' }

function firebaseConfig(name) {
  return {
    apiKey: 'demo-key',
    authDomain: `${PROJECT_ID}.firebaseapp.com`,
    projectId: PROJECT_ID,
    appId: `demo-${name}`,
  }
}

function createFunctionsFor(name) {
  const app = initializeApp(firebaseConfig(name), name)
  const functions = getFunctions(app)
  const asiaFunctions = getFunctions(app, ASIA_FUNCTIONS_REGION)
  connectFunctionsEmulator(functions, FUNCTIONS_HOST, FUNCTIONS_PORT)
  connectFunctionsEmulator(asiaFunctions, FUNCTIONS_HOST, FUNCTIONS_PORT)
  return { app, asiaFunctions, functions }
}

function createStaffClient(name) {
  const app = initializeApp(firebaseConfig(name), name)
  const functions = getFunctions(app)
  const asiaFunctions = getFunctions(app, ASIA_FUNCTIONS_REGION)
  const auth = getAuth(app)
  connectFunctionsEmulator(functions, FUNCTIONS_HOST, FUNCTIONS_PORT)
  connectFunctionsEmulator(asiaFunctions, FUNCTIONS_HOST, FUNCTIONS_PORT)
  connectAuthEmulator(auth, `http://${AUTH_HOST}:${AUTH_PORT}`, { disableWarnings: true })
  return { app, asiaFunctions, auth, functions }
}

function adminDb() {
  const app = getApps().find(existing => existing.name === 'order-functions-emulator') ||
    initializeAdminApp({ projectId: PROJECT_ID }, 'order-functions-emulator')
  return getFirestore(app)
}

async function call(functions, name, data) {
  const callable = httpsCallable(functions, name)
  const result = await callable(data)
  return result.data
}

async function expectCallableError(expectedCode, action, label) {
  try {
    await action()
  } catch (error) {
    const actualCode = callableErrorCode(error)
    assert.equal(actualCode, expectedCode, `${label} should reject with ${expectedCode}`)
    return
  }
  assert.fail(`${label} should reject with ${expectedCode}`)
}

function callableErrorCode(error) {
  return error?.details?.code ?? String(error?.code ?? '').replace(/^functions\//, '')
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

async function waitFor(label, read, predicate, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  let latest
  while (Date.now() < deadline) {
    latest = await read()
    if (predicate(latest)) return latest
    await sleep(100)
  }
  assert.fail(`${label} did not settle before timeout: ${JSON.stringify(latest)}`)
}

function cartItem(productId, quantity = 1) {
  return {
    product: { id: productId },
    quantity,
    optionSelections: [],
  }
}

async function seedBaseData(db) {
  const categoryId = `${runId}_cat_food`
  const drinkCategoryId = `${runId}_cat_drink`
  const otherCategoryId = `${runId}_cat_other`
  const productId = `${runId}_product_food`
  const drinkProductId = `${runId}_product_drink`
  const otherProductId = `${runId}_product_other_store`
  const categoryMismatchProductId = `${runId}_product_bad_category`
  const now = FieldValue.serverTimestamp()

  await Promise.all([
    db.collection('categories').doc(categoryId).set({
      storeId,
      name: 'Food',
      group: 'food',
      isActive: true,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
    }),
    db.collection('categories').doc(drinkCategoryId).set({
      storeId,
      name: 'Drink',
      group: 'drink',
      isActive: true,
      sortOrder: 2,
      createdAt: now,
      updatedAt: now,
    }),
    db.collection('categories').doc(otherCategoryId).set({
      storeId: otherStoreId,
      name: 'Other Store',
      group: 'food',
      isActive: true,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
    }),
  ])

  await Promise.all([
    db.collection('products').doc(productId).set({
      storeId,
      name: 'Emulator Ramen',
      price: 900,
      categoryId,
      isVisible: true,
      isSoldOut: false,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
    }),
    db.collection('products').doc(drinkProductId).set({
      storeId,
      name: 'Emulator Tea',
      price: 300,
      categoryId: drinkCategoryId,
      isVisible: true,
      isSoldOut: false,
      sortOrder: 2,
      createdAt: now,
      updatedAt: now,
    }),
    db.collection('products').doc(otherProductId).set({
      storeId: otherStoreId,
      name: 'Wrong Store Product',
      price: 1,
      categoryId: otherCategoryId,
      isVisible: true,
      isSoldOut: false,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
    }),
    db.collection('products').doc(categoryMismatchProductId).set({
      storeId,
      name: 'Wrong Category Product',
      price: 1,
      categoryId: otherCategoryId,
      isVisible: true,
      isSoldOut: false,
      sortOrder: 3,
      createdAt: now,
      updatedAt: now,
    }),
  ])

  return { categoryMismatchProductId, drinkProductId, otherProductId, productId }
}

async function seedTable(db, tableId, overrides = {}) {
  await db.collection('tables').doc(tableId).set({
    storeId,
    tableName: tableId,
    qrToken: `${tableId}_qr`,
    status: 'vacant',
    currentOrderId: null,
    guestCount: 0,
    pendingCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    ...overrides,
  })
}

async function tableData(db, tableId) {
  const snap = await db.collection('tables').doc(tableId).get()
  assert.ok(snap.exists, `table ${tableId} should exist`)
  return { id: snap.id, ...snap.data() }
}

async function orderData(db, orderId) {
  const snap = await db.collection('orders').doc(orderId).get()
  assert.ok(snap.exists, `order ${orderId} should exist`)
  return { id: snap.id, ...snap.data() }
}

async function itemData(db, itemId) {
  const snap = await db.collection('orderItems').doc(itemId).get()
  assert.ok(snap.exists, `order item ${itemId} should exist`)
  return { id: snap.id, ...snap.data() }
}

async function queryBy(db, collectionName, field, value) {
  const snap = await db.collection(collectionName).where(field, '==', value).get()
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

function orderItemSubtotal(items) {
  return items
    .filter(item => (item.itemStatus ?? 'ordered') !== 'cancelled')
    .reduce((sum, item) => sum + (Number(item.lineTotal) || 0), 0)
}

function checkoutPayload({
  checkoutItemIds = [],
  guestCount = 2,
  orderId,
  orderItemsRevision = 0,
  tableId,
  total = 0,
}) {
  return {
    storeId,
    tableId,
    orderId,
    guestCount,
    subtotalBeforeItemDiscount: total,
    itemDiscountAmount: 0,
    activeItemDiscounts: [],
    checkoutItemIds,
    orderItemsRevision,
    subtotal: total,
    checkoutDiscountAmount: 0,
    totalDiscountAmount: 0,
    discountNote: '',
    total,
    received: total,
    change: 0,
    activeStaff: staff,
  }
}

async function runCustomerStartRace(db, publicFunctions, productId) {
  const tableId = `${runId}_race_table`
  const guestCount = 4
  await seedTable(db, tableId)

  const settled = await Promise.allSettled(Array.from({ length: 50 }, () => (
    call(publicFunctions, 'startCustomerOrderSessionCommand', {
      guestAutoAdd: {
        enabled: true,
        productId,
        productNameSnapshot: 'Race Auto Add',
      },
      guestCount,
      storeId,
      tableId,
    })
  )))
  const rejected = settled.filter(result => result.status === 'rejected')
  assert.equal(
    rejected.length,
    0,
    `same-table customer start race should not reject: ${rejected.map(result => callableErrorCode(result.reason)).join(', ')}`
  )

  const results = settled.map(result => result.value)
  const orderIds = new Set(results)
  assert.equal(orderIds.size, 1, 'same-table customer start race should return one order id')
  const [orderId] = orderIds
  const orders = await queryBy(db, 'orders', 'tableId', tableId)
  assert.equal(orders.length, 1, 'same-table customer start race should create one order')
  assert.equal(orders[0].status, 'open', 'same-table customer start race should keep one open order')
  assert.equal(orders[0].guestCount, guestCount, 'same-table customer start race should keep the winning guest count')

  const table = await tableData(db, tableId)
  assert.equal(table.currentOrderId, orderId)
  assert.equal(table.status, 'occupied')
  assert.equal(table.guestCount, guestCount)
  assert.equal(table.pendingCount, 1, 'auto-add should count one order item line')

  const autoAddItems = await queryBy(db, 'orderItems', 'orderId', orderId)
  assert.equal(autoAddItems.length, 1, 'same-table customer start race should create one auto-add item')
  assert.equal(autoAddItems[0].productId, productId)
  assert.equal(autoAddItems[0].quantity, guestCount)
  assert.equal(autoAddItems[0].clientRequestId, `auto-add-${orderId}`)
}

async function runCustomerSubmitDedup(db, publicFunctions, productId) {
  const tableId = `${runId}_customer_submit_table`
  const requestId = `${runId}_same_customer_request`
  await seedTable(db, tableId)
  const orderId = await call(publicFunctions, 'startCustomerOrderSessionCommand', {
    guestAutoAdd: { enabled: false },
    guestCount: 2,
    storeId,
    tableId,
  })

  const payload = {
    items: [cartItem(productId), cartItem(productId, 2)],
    orderId,
    storeId,
    tableId,
    clientRequestId: requestId,
  }
  const results = await Promise.all(Array.from({ length: 20 }, () => (
    call(publicFunctions, 'submitCustomerOrderItemsCommand', payload)
  )))

  const items = await queryBy(db, 'orderItems', 'clientRequestId', requestId)
  assert.ok(results.every(result => result.ok === true), 'duplicate customer submit should return ok results')
  assert.equal(new Set(results.map(result => result.clientRequestId)).size, 1, 'duplicate customer submit should keep one request id')
  assert.ok(results.some(result => result.deduped === true), 'duplicate customer submit should report deduped retries')
  assert.equal(items.length, payload.items.length, 'duplicate customer submit should create one set of item docs')

  const retryResult = await call(publicFunctions, 'submitCustomerOrderItemsCommand', payload)
  const retryItems = await queryBy(db, 'orderItems', 'clientRequestId', requestId)
  assert.equal(retryResult.deduped, true, 'timeout-style retry with same request id should dedupe')
  assert.equal(retryItems.length, payload.items.length, 'timeout-style retry should not create extra item docs')
}

async function runAsiaCustomerSubmitDedup(db, publicFunctions, asiaFunctions, productId) {
  const tableId = `${runId}_asia_customer_submit_table`
  const requestId = `${runId}_same_asia_customer_request`
  await seedTable(db, tableId)
  const orderId = await call(publicFunctions, 'startCustomerOrderSessionCommand', {
    guestAutoAdd: { enabled: false },
    guestCount: 2,
    storeId,
    tableId,
  })
  const payload = {
    items: [cartItem(productId), cartItem(productId, 2)],
    orderId,
    storeId,
    tableId,
    clientRequestId: requestId,
  }

  const results = await Promise.all(Array.from({ length: 12 }, () => (
    call(asiaFunctions, 'submitCustomerOrderItemsCommandAsia', payload)
  )))
  const retryResult = await call(asiaFunctions, 'submitCustomerOrderItemsCommandAsia', payload)
  const items = await queryBy(db, 'orderItems', 'clientRequestId', requestId)

  assert.ok(results.every(result => result.ok === true), 'Asia customer submit should return ok results')
  assert.ok(results.some(result => result.deduped === true), 'Asia customer submit should dedupe concurrent retries')
  assert.equal(retryResult.deduped, true, 'Asia customer timeout-style retry should dedupe')
  assert.equal(items.length, payload.items.length, 'Asia customer retries should create one set of item docs')
}

async function runCustomerDistinctSubmitRequests(db, publicFunctions, productId) {
  const tableId = `${runId}_customer_distinct_submit_table`
  await seedTable(db, tableId)
  const orderId = await call(publicFunctions, 'startCustomerOrderSessionCommand', {
    guestAutoAdd: { enabled: false },
    guestCount: 5,
    storeId,
    tableId,
  })
  const requestIds = Array.from({ length: 5 }, (_, index) => `${runId}_distinct_customer_request_${index + 1}`)

  await Promise.all(requestIds.map((clientRequestId, index) => (
    call(publicFunctions, 'submitCustomerOrderItemsCommand', {
      items: [cartItem(productId, index + 1)],
      orderId,
      storeId,
      tableId,
      clientRequestId,
    })
  )))

  const items = await queryBy(db, 'orderItems', 'orderId', orderId)
  const submittedItems = items.filter(item => requestIds.includes(item.clientRequestId))
  assert.equal(submittedItems.length, requestIds.length, 'distinct customer requests should each create an item')
  assert.equal(new Set(submittedItems.map(item => item.clientRequestId)).size, requestIds.length, 'distinct customer requests should not dedupe each other')
}

async function runUnauthorizedStaffReject(db, staffFunctions) {
  const tableId = `${runId}_unauthorized_staff_table`
  await seedTable(db, tableId)
  await expectCallableError('permission-denied', () => (
    call(staffFunctions, 'seatStaffOrderSessionCommand', { tableId, seatCount: 2, activeStaff: staff })
  ), 'staff command without staff session')
}

async function createStaffSession(db, uid) {
  await db.collection('staffSessions').doc(uid).set({
    storeId,
    code: `${runId}_staff_code`,
    permissions: {
      useKitchen: true,
      closeRegister: true,
      manageMenu: true,
      manageTables: true,
    },
    createdAt: FieldValue.serverTimestamp(),
  })
}

async function runStaffSubmitDedup(db, staffFunctions, productId, drinkProductId) {
  const tableId = `${runId}_staff_submit_table`
  const requestId = `${runId}_same_staff_request`
  await seedTable(db, tableId)
  const orderId = await call(staffFunctions, 'seatStaffOrderSessionCommand', {
    tableId,
    seatCount: 3,
    activeStaff: staff,
  })

  const payload = {
    activeStaff: staff,
    cart: [cartItem(productId), cartItem(drinkProductId), cartItem(productId, 2)],
    orderId,
    storeId,
    tableId,
    clientRequestId: requestId,
  }
  await Promise.all(Array.from({ length: 12 }, () => (
    call(staffFunctions, 'submitStaffOrderItemsCommand', payload)
  )))

  const items = await queryBy(db, 'orderItems', 'clientRequestId', requestId)
  assert.equal(items.length, payload.cart.length, 'duplicate staff submit should create one set of item docs')
  assert.ok(items.every(item => item.orderedByStaffId === staff.id), 'staff submit should store staff id on order items')
  assert.ok(items.every(item => item.orderedByStaffName === staff.name), 'staff submit should store staff name on order items')
  assert.equal((await tableData(db, tableId)).pendingCount, payload.cart.length, 'duplicate staff submit should increment pendingCount once')
  return { itemIds: items.map(item => item.id), orderId, tableId }
}

async function runAsiaStaffSubmitDedup(db, staffFunctions, asiaFunctions, productId, drinkProductId) {
  const tableId = `${runId}_asia_staff_submit_table`
  const requestId = `${runId}_same_asia_staff_request`
  await seedTable(db, tableId)
  const orderId = await call(staffFunctions, 'seatStaffOrderSessionCommand', {
    tableId,
    seatCount: 3,
    activeStaff: staff,
  })
  const payload = {
    activeStaff: staff,
    cart: [cartItem(productId), cartItem(drinkProductId), cartItem(productId, 2)],
    orderId,
    storeId,
    tableId,
    clientRequestId: requestId,
  }

  const results = await Promise.all(Array.from({ length: 12 }, () => (
    call(asiaFunctions, 'submitStaffOrderItemsCommandAsia', payload)
  )))
  const retryResult = await call(asiaFunctions, 'submitStaffOrderItemsCommandAsia', payload)
  const items = await queryBy(db, 'orderItems', 'clientRequestId', requestId)

  assert.ok(results.every(result => result.ok === true), 'Asia staff submit should return ok results')
  assert.ok(results.some(result => result.deduped === true), 'Asia staff submit should dedupe concurrent retries')
  assert.equal(retryResult.deduped, true, 'Asia staff timeout-style retry should dedupe')
  assert.equal(items.length, payload.cart.length, 'Asia staff retries should create one set of item docs')
  assert.equal((await tableData(db, tableId)).pendingCount, payload.cart.length, 'Asia staff retries should increment pendingCount once')
}

async function runItemStatusCounterChecks(db, staffFunctions, productId) {
  const tableId = `${runId}_status_table`
  const requestId = `${runId}_status_request`
  await seedTable(db, tableId)
  const orderId = await call(staffFunctions, 'seatStaffOrderSessionCommand', {
    tableId,
    seatCount: 2,
    activeStaff: staff,
  })
  await call(staffFunctions, 'submitStaffOrderItemsCommand', {
    activeStaff: staff,
    cart: [cartItem(productId), cartItem(productId), cartItem(productId)],
    orderId,
    storeId,
    tableId,
    clientRequestId: requestId,
  })
  const itemIds = (await queryBy(db, 'orderItems', 'clientRequestId', requestId)).map(item => item.id)
  const [servedItemId, cancelledItemId, servedCancelItemId] = itemIds
  assert.equal((await tableData(db, tableId)).pendingCount, 3)

  await Promise.all(Array.from({ length: 8 }, () => (
    call(staffFunctions, 'markOrderItemServedCommand', { tableId, itemId: servedItemId })
  )))
  assert.equal((await itemData(db, servedItemId)).itemStatus, 'served')
  assert.equal((await tableData(db, tableId)).pendingCount, 2, 'served double-tap should decrement once')

  await Promise.all(Array.from({ length: 8 }, () => (
    call(staffFunctions, 'markOrderItemOrderedCommand', { tableId, itemId: servedItemId })
  )))
  assert.equal((await itemData(db, servedItemId)).itemStatus, 'ordered')
  assert.equal((await tableData(db, tableId)).pendingCount, 3, 'served revert double-tap should increment once')

  await Promise.all(Array.from({ length: 8 }, () => (
    call(staffFunctions, 'cancelOrderItemCommand', { tableId, itemId: cancelledItemId, tableName: tableId, source: 'staff_table', activeStaff: staff })
  )))
  assert.equal((await itemData(db, cancelledItemId)).itemStatus, 'cancelled')
  assert.equal((await tableData(db, tableId)).pendingCount, 2, 'ordered cancel double-tap should decrement once')

  await call(staffFunctions, 'markOrderItemServedCommand', { tableId, itemId: servedCancelItemId })
  assert.equal((await tableData(db, tableId)).pendingCount, 1)
  await Promise.all(Array.from({ length: 4 }, () => (
    call(staffFunctions, 'cancelOrderItemCommand', { tableId, itemId: servedCancelItemId, tableName: tableId, source: 'staff_table', activeStaff: staff })
  )))
  assert.equal((await itemData(db, servedCancelItemId)).itemStatus, 'cancelled')
  assert.equal((await tableData(db, tableId)).pendingCount, 1, 'served cancel should not decrement pendingCount')
}

async function runLateSubmitAfterCheckout(db, publicFunctions, staffFunctions, productId) {
  const tableId = `${runId}_checkout_table`
  await seedTable(db, tableId)
  const orderId = await call(publicFunctions, 'startCustomerOrderSessionCommand', {
    guestAutoAdd: { enabled: false },
    guestCount: 2,
    storeId,
    tableId,
  })
  const order = await orderData(db, orderId)
  await call(staffFunctions, 'completeCheckoutCommand', checkoutPayload({
    checkoutItemIds: [],
    orderId,
    orderItemsRevision: order.orderItemsRevision ?? 0,
    tableId,
  }))

  await expectCallableError('order-not-open', () => (
    call(publicFunctions, 'submitCustomerOrderItemsCommand', {
      items: [cartItem(productId)],
      orderId,
      storeId,
      tableId,
      clientRequestId: `${runId}_late_submit`,
    })
  ), 'late submit after checkout')
}

async function runDoubleCheckoutIdempotency(db, publicFunctions, staffFunctions) {
  const tableId = `${runId}_double_checkout_table`
  await seedTable(db, tableId)
  const orderId = await call(publicFunctions, 'startCustomerOrderSessionCommand', {
    guestAutoAdd: { enabled: false },
    guestCount: 2,
    storeId,
    tableId,
  })
  const order = await orderData(db, orderId)
  const payload = checkoutPayload({
    checkoutItemIds: [],
    orderId,
    orderItemsRevision: order.orderItemsRevision ?? 0,
    tableId,
  })

  const settled = await Promise.allSettled(Array.from({ length: 8 }, () => (
    call(staffFunctions, 'completeCheckoutCommand', payload)
  )))
  const rejected = settled.filter(result => result.status === 'rejected')
  assert.equal(
    rejected.length,
    0,
    `double checkout should return the same check id without rejects: ${rejected.map(result => callableErrorCode(result.reason)).join(', ')}`
  )
  assert.equal(new Set(settled.map(result => result.value)).size, 1, 'double checkout should converge to one check id')
  const checks = await queryBy(db, 'checks', 'orderId', orderId)
  assert.equal(checks.length, 1, 'double checkout should create one check document')
  assert.equal((await orderData(db, orderId)).status, 'checked_out')
  assert.equal((await tableData(db, tableId)).currentOrderId, null)
}

async function runCheckoutSubmitRace(db, publicFunctions, staffFunctions, productId) {
  const tableId = `${runId}_checkout_submit_race_table`
  await seedTable(db, tableId)
  const orderId = await call(publicFunctions, 'startCustomerOrderSessionCommand', {
    guestAutoAdd: { enabled: false },
    guestCount: 2,
    storeId,
    tableId,
  })
  const order = await orderData(db, orderId)
  const submitRequestId = `${runId}_checkout_submit_race`
  const checkoutRequest = checkoutPayload({
    checkoutItemIds: [],
    orderId,
    orderItemsRevision: order.orderItemsRevision ?? 0,
    tableId,
  })

  const [submitResult, checkoutResult] = await Promise.allSettled([
    call(publicFunctions, 'submitCustomerOrderItemsCommand', {
      items: [cartItem(productId)],
      orderId,
      storeId,
      tableId,
      clientRequestId: submitRequestId,
    }),
    call(staffFunctions, 'completeCheckoutCommand', checkoutRequest),
  ])

  assert.ok(
    !(submitResult.status === 'fulfilled' && checkoutResult.status === 'fulfilled'),
    'checkout and late submit should not both commit with a stale checkout snapshot'
  )

  const raceItems = await queryBy(db, 'orderItems', 'clientRequestId', submitRequestId)
  const checks = await queryBy(db, 'checks', 'orderId', orderId)

  if (checkoutResult.status === 'fulfilled') {
    assert.equal(submitResult.status, 'rejected', 'checkout-first race should reject the late customer submit')
    assert.equal(callableErrorCode(submitResult.reason), 'order-not-open')
    assert.equal(raceItems.length, 0, 'checkout-first race should not save the late order item')
    assert.equal(checks.length, 1, 'checkout-first race should create one check')
    assert.equal((await tableData(db, tableId)).currentOrderId, null)
    return
  }

  assert.equal(submitResult.status, 'fulfilled', 'submit-first race should save the customer item')
  assert.equal(callableErrorCode(checkoutResult.reason), 'checkout-items-stale')
  assert.equal(raceItems.length, 1, 'submit-first race should keep the accepted item on the open order')
  assert.equal(checks.length, 0, 'submit-first stale checkout should not create a check')
  assert.equal((await orderData(db, orderId)).status, 'open')
  assert.equal((await tableData(db, tableId)).currentOrderId, orderId)

  const liveItems = await queryBy(db, 'orderItems', 'orderId', orderId)
  const liveOrder = await orderData(db, orderId)
  await call(staffFunctions, 'completeCheckoutCommand', checkoutPayload({
    checkoutItemIds: liveItems.map(item => item.id),
    orderId,
    orderItemsRevision: liveOrder.orderItemsRevision ?? 0,
    tableId,
    total: orderItemSubtotal(liveItems),
  }))
  assert.equal((await queryBy(db, 'checks', 'orderId', orderId)).length, 1, 'fresh checkout after reload should create one check')
  assert.equal((await orderData(db, orderId)).status, 'checked_out')
}

async function runTableMoveConsistency(db, staffFunctions, productId) {
  const sourceTableId = `${runId}_move_source`
  const targetTableId = `${runId}_move_target`
  const requestId = `${runId}_move_request`
  await Promise.all([seedTable(db, sourceTableId), seedTable(db, targetTableId)])
  const orderId = await call(staffFunctions, 'seatStaffOrderSessionCommand', {
    tableId: sourceTableId,
    seatCount: 4,
    activeStaff: staff,
  })
  await call(staffFunctions, 'submitStaffOrderItemsCommand', {
    activeStaff: staff,
    cart: [cartItem(productId), cartItem(productId), cartItem(productId)],
    orderId,
    storeId,
    tableId: sourceTableId,
    clientRequestId: requestId,
  })
  const itemIds = (await queryBy(db, 'orderItems', 'clientRequestId', requestId)).map(item => item.id)
  await call(staffFunctions, 'markOrderItemServedCommand', { tableId: sourceTableId, itemId: itemIds[0] })
  await call(staffFunctions, 'moveTableOrderCommand', {
    sourceTableId,
    targetTable: { id: targetTableId },
    activeStaff: staff,
  })

  const sourceTable = await tableData(db, sourceTableId)
  const targetTable = await tableData(db, targetTableId)
  const order = await orderData(db, orderId)
  const movedItems = await queryBy(db, 'orderItems', 'orderId', orderId)

  assert.equal(sourceTable.status, 'vacant')
  assert.equal(sourceTable.currentOrderId, null)
  assert.equal(targetTable.status, 'occupied')
  assert.equal(targetTable.currentOrderId, orderId)
  assert.equal(targetTable.pendingCount, 2)
  assert.equal(order.tableId, targetTableId)
  assert.ok(movedItems.every(item => item.tableId === targetTableId), 'all order items should move to target table')
}

async function runTableMoveCustomerSubmitRace(db, publicFunctions, staffFunctions, productId) {
  const sourceTableId = `${runId}_move_submit_source`
  const targetTableId = `${runId}_move_submit_target`
  const requestId = `${runId}_move_submit_request`
  await Promise.all([seedTable(db, sourceTableId), seedTable(db, targetTableId)])
  const orderId = await call(publicFunctions, 'startCustomerOrderSessionCommand', {
    guestAutoAdd: { enabled: false },
    guestCount: 2,
    storeId,
    tableId: sourceTableId,
  })

  const [submitResult, moveResult] = await Promise.allSettled([
    call(publicFunctions, 'submitCustomerOrderItemsCommand', {
      items: [cartItem(productId)],
      orderId,
      storeId,
      tableId: sourceTableId,
      clientRequestId: requestId,
    }),
    call(staffFunctions, 'moveTableOrderCommand', {
      sourceTableId,
      targetTable: { id: targetTableId },
      activeStaff: staff,
    }),
  ])

  assert.equal(moveResult.status, 'fulfilled', `move vs submit race should keep move command safe: ${callableErrorCode(moveResult.reason)}`)
  const sourceTable = await tableData(db, sourceTableId)
  const targetTable = await tableData(db, targetTableId)
  const order = await orderData(db, orderId)
  const raceItems = await queryBy(db, 'orderItems', 'clientRequestId', requestId)

  assert.equal(sourceTable.status, 'vacant')
  assert.equal(sourceTable.currentOrderId, null)
  assert.equal(targetTable.status, 'occupied')
  assert.equal(targetTable.currentOrderId, orderId)
  assert.equal(order.tableId, targetTableId)

  if (submitResult.status === 'fulfilled') {
    assert.equal(raceItems.length, 1, 'submit-first move race should keep one accepted item')
    assert.ok(raceItems.every(item => item.tableId === targetTableId), 'submit-first move race should move accepted items to target table')
    assert.equal(targetTable.pendingCount, 1, 'submit-first move race should count the moved pending item')
    return
  }

  assert.equal(callableErrorCode(submitResult.reason), 'order-scope-mismatch')
  assert.equal(raceItems.length, 0, 'move-first race should reject the stale source-table submit without saving an item')
  assert.equal(targetTable.pendingCount, 0, 'move-first race should not add a stale pending item')
}

async function runReservationGuideCommand(db, staffFunctions) {
  const tableId = `${runId}_reservation_table`
  const reservationId = `${runId}_reservation_wait`
  await seedTable(db, tableId)
  await db.collection('reservations').doc(reservationId).set({
    storeId,
    tableId,
    name: 'Emulator Reservation',
    guestCount: 5,
    status: 'confirmed',
    waitingStatus: 'pending',
    waitingReason: 'table_unassigned',
    arrivalNoticeAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  const result = await call(staffFunctions, 'guideReservationToTableCommand', {
    reservationId,
    targetTableId: tableId,
    storeId,
    activeStaff: staff,
  })

  assert.equal(result.ok, true, 'reservation guide command should succeed')
  assert.equal(result.wasOccupied, false, 'reservation guide to vacant table should report vacant path')
  assert.ok(result.orderId, 'reservation guide command should return an order id')

  const reservationSnap = await db.collection('reservations').doc(reservationId).get()
  const reservation = reservationSnap.data()
  const table = await tableData(db, tableId)
  const order = await orderData(db, result.orderId)

  assert.equal(reservation.status, 'seated')
  assert.equal(reservation.waitingStatus, 'handled')
  assert.equal(reservation.seatedTableId, tableId)
  assert.equal(reservation.seatedOrderId, result.orderId)
  assert.equal(table.status, 'occupied')
  assert.equal(table.currentOrderId, result.orderId)
  assert.equal(order.createdBy, 'reservation')
  assert.equal(order.reservationId, reservationId)
}

async function runStoreScopeRejects(db, publicFunctions, productId, otherProductId, categoryMismatchProductId) {
  const tableId = `${runId}_scope_table`
  await seedTable(db, tableId)
  const orderId = await call(publicFunctions, 'startCustomerOrderSessionCommand', {
    guestAutoAdd: { enabled: false },
    guestCount: 1,
    storeId,
    tableId,
  })

  await expectCallableError('product-scope-mismatch', () => (
    call(publicFunctions, 'submitCustomerOrderItemsCommand', {
      items: [cartItem(otherProductId)],
      orderId,
      storeId,
      tableId,
      clientRequestId: `${runId}_wrong_product_store`,
    })
  ), 'product store mismatch')

  await expectCallableError('category-scope-mismatch', () => (
    call(publicFunctions, 'submitCustomerOrderItemsCommand', {
      items: [cartItem(categoryMismatchProductId)],
      orderId,
      storeId,
      tableId,
      clientRequestId: `${runId}_wrong_category_store`,
    })
  ), 'category store mismatch')

  await call(publicFunctions, 'submitCustomerOrderItemsCommand', {
    items: [cartItem(productId)],
    orderId,
    storeId,
    tableId,
    clientRequestId: `${runId}_scope_valid_submit`,
  })
}

async function runPendingAggregateTriggerChecks(db) {
  const tableId = `${runId}_aggregate_trigger_table`
  const itemRef = db.collection('orderItems').doc(`${runId}_aggregate_trigger_item`)
  await seedTable(db, tableId, {
    pendingAggregateVersion: 1,
    pendingAggregateCount: 0,
    pendingAggregateDrinkCount: 0,
    pendingAggregateFoodCount: 0,
  })

  const aggregateMatches = expected => async () => {
    const table = await tableData(db, tableId)
    return {
      count: table.pendingAggregateCount,
      drink: table.pendingAggregateDrinkCount,
      food: table.pendingAggregateFoodCount,
      matches: table.pendingAggregateCount === expected.count &&
        table.pendingAggregateDrinkCount === expected.drink &&
        table.pendingAggregateFoodCount === expected.food,
    }
  }
  const waitForAggregate = async (label, expected) => waitFor(
    label,
    aggregateMatches(expected),
    value => value.matches,
  )

  await itemRef.set({
    storeId,
    tableId,
    orderId: `${runId}_aggregate_order`,
    itemStatus: 'ordered',
    categoryGroup: 'food',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  await waitForAggregate('pending aggregate create trigger', { count: 1, drink: 0, food: 1 })

  await itemRef.update({ categoryGroup: 'drink', updatedAt: FieldValue.serverTimestamp() })
  await waitForAggregate('pending aggregate update trigger', { count: 1, drink: 1, food: 0 })

  await itemRef.update({ itemStatus: 'served', updatedAt: FieldValue.serverTimestamp() })
  await waitForAggregate('pending aggregate served trigger', { count: 0, drink: 0, food: 0 })

  await itemRef.update({ itemStatus: 'ordered', updatedAt: FieldValue.serverTimestamp() })
  await waitForAggregate('pending aggregate ordered trigger', { count: 1, drink: 1, food: 0 })

  await itemRef.delete()
  await waitForAggregate('pending aggregate delete trigger', { count: 0, drink: 0, food: 0 })
}

async function runReservationNotificationTriggerCheck(db) {
  const reservationRef = db.collection('reservations').doc(`${runId}_notification_trigger`)
  await reservationRef.set({
    storeId,
    name: 'Emulator Notification',
    time: '19:00',
    guestCount: 2,
    status: 'confirmed',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  await waitFor(
    'reservation notification trigger',
    async () => (await reservationRef.get()).data(),
    reservation => Boolean(reservation?.createdNoticeSentAt),
  )
}

const db = adminDb()
const publicClient = createFunctionsFor(`public-${runId}`)
const staffClient = createStaffClient(`staff-${runId}`)
const staffCredential = await signInAnonymously(staffClient.auth)
const products = await seedBaseData(db)

await runCustomerStartRace(db, publicClient.functions, products.productId)
await runCustomerSubmitDedup(db, publicClient.functions, products.productId)
await runAsiaCustomerSubmitDedup(db, publicClient.functions, publicClient.asiaFunctions, products.productId)
await runCustomerDistinctSubmitRequests(db, publicClient.functions, products.productId)
await runUnauthorizedStaffReject(db, staffClient.functions)
await createStaffSession(db, staffCredential.user.uid)
await runStaffSubmitDedup(db, staffClient.functions, products.productId, products.drinkProductId)
await runAsiaStaffSubmitDedup(db, staffClient.functions, staffClient.asiaFunctions, products.productId, products.drinkProductId)
await runItemStatusCounterChecks(db, staffClient.functions, products.productId)
await runLateSubmitAfterCheckout(db, publicClient.functions, staffClient.functions, products.productId)
await runDoubleCheckoutIdempotency(db, publicClient.functions, staffClient.functions)
await runCheckoutSubmitRace(db, publicClient.functions, staffClient.functions, products.productId)
await runTableMoveConsistency(db, staffClient.functions, products.productId)
await runTableMoveCustomerSubmitRace(db, publicClient.functions, staffClient.functions, products.productId)
await runReservationGuideCommand(db, staffClient.functions)
await runStoreScopeRejects(db, publicClient.functions, products.productId, products.otherProductId, products.categoryMismatchProductId)
await runPendingAggregateTriggerChecks(db)
await runReservationNotificationTriggerCheck(db)

console.log(`order Functions emulator concurrency and trigger checks passed on Node ${process.version}`)
