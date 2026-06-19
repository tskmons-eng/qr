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
const AUTH_HOST = '127.0.0.1'
const AUTH_PORT = 9099
const INSIDE_ENV = 'QR_ORDER_FUNCTIONS_EMULATOR_INSIDE'
const JAVA_EXE = process.platform === 'win32' ? 'java.exe' : 'java'

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
  connectFunctionsEmulator(functions, FUNCTIONS_HOST, FUNCTIONS_PORT)
  return { app, functions }
}

function createStaffClient(name) {
  const app = initializeApp(firebaseConfig(name), name)
  const functions = getFunctions(app)
  const auth = getAuth(app)
  connectFunctionsEmulator(functions, FUNCTIONS_HOST, FUNCTIONS_PORT)
  connectAuthEmulator(auth, `http://${AUTH_HOST}:${AUTH_PORT}`, { disableWarnings: true })
  return { app, auth, functions }
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
    const actualCode = error?.details?.code ?? String(error?.code ?? '').replace(/^functions\//, '')
    assert.equal(actualCode, expectedCode, `${label} should reject with ${expectedCode}`)
    return
  }
  assert.fail(`${label} should reject with ${expectedCode}`)
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

async function runCustomerStartRace(db, publicFunctions) {
  const tableId = `${runId}_race_table`
  await seedTable(db, tableId)

  const results = await Promise.all(Array.from({ length: 16 }, () => (
    call(publicFunctions, 'startCustomerOrderSessionCommand', {
      guestAutoAdd: { enabled: false },
      guestCount: 2,
      storeId,
      tableId,
    })
  )))

  const orderIds = new Set(results)
  assert.equal(orderIds.size, 1, 'same-table customer start race should return one order id')
  const [orderId] = orderIds
  const orders = await queryBy(db, 'orders', 'tableId', tableId)
  assert.equal(orders.length, 1, 'same-table customer start race should create one order')
  assert.equal((await tableData(db, tableId)).currentOrderId, orderId)
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
  await Promise.all(Array.from({ length: 12 }, () => (
    call(publicFunctions, 'submitCustomerOrderItemsCommand', payload)
  )))

  const items = await queryBy(db, 'orderItems', 'clientRequestId', requestId)
  assert.equal(items.length, payload.items.length, 'duplicate customer submit should create one set of item docs')
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
  assert.equal((await tableData(db, tableId)).pendingCount, payload.cart.length, 'duplicate staff submit should increment pendingCount once')
  return { itemIds: items.map(item => item.id), orderId, tableId }
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
  await call(staffFunctions, 'completeCheckoutCommand', {
    storeId,
    tableId,
    orderId,
    guestCount: 2,
    subtotalBeforeItemDiscount: 0,
    itemDiscountAmount: 0,
    activeItemDiscounts: [],
    subtotal: 0,
    checkoutDiscountAmount: 0,
    totalDiscountAmount: 0,
    discountNote: '',
    total: 0,
    received: 0,
    change: 0,
    activeStaff: staff,
  })

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

const db = adminDb()
const publicClient = createFunctionsFor(`public-${runId}`)
const staffClient = createStaffClient(`staff-${runId}`)
const staffCredential = await signInAnonymously(staffClient.auth)
const products = await seedBaseData(db)

await runCustomerStartRace(db, publicClient.functions)
await runCustomerSubmitDedup(db, publicClient.functions, products.productId)
await runUnauthorizedStaffReject(db, staffClient.functions)
await createStaffSession(db, staffCredential.user.uid)
await runStaffSubmitDedup(db, staffClient.functions, products.productId, products.drinkProductId)
await runItemStatusCounterChecks(db, staffClient.functions, products.productId)
await runLateSubmitAfterCheckout(db, publicClient.functions, staffClient.functions, products.productId)
await runTableMoveConsistency(db, staffClient.functions, products.productId)
await runStoreScopeRejects(db, publicClient.functions, products.productId, products.otherProductId, products.categoryMismatchProductId)

console.log('order Functions emulator concurrency checks passed')
