import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const functionExports = [
  'startCustomerOrderSessionCommand',
  'submitCustomerOrderItemsCommand',
  'submitCustomerOrderItemsCommandAsia',
  'submitStaffOrderItemsCommand',
  'submitStaffOrderItemsCommandAsia',
  'seatStaffOrderSessionCommand',
  'completeCheckoutCommand',
  'markOrderItemServedCommand',
  'markOrderItemsServedCommand',
  'markOrderItemOrderedCommand',
  'cancelOrderItemCommand',
  'moveTableOrderCommand',
  'guideReservationToTableCommand',
]

const [
  functionsIndex,
  handlers,
  api,
  auth,
  clientRuntime,
  rules,
  firebaseJson,
  functionsPackage,
  functionsLock,
  packageJson,
] = await Promise.all([
  readFile('functions/index.js', 'utf8'),
  readFile('functions/orderCommandHandlers.js', 'utf8'),
  readFile('functions/orderCommandApi.js', 'utf8'),
  readFile('functions/orderCommandAuth.js', 'utf8'),
  readFile('src/services/orderFunctionCommandService.js', 'utf8'),
  readFile('firestore.rules', 'utf8'),
  readFile('firebase.json', 'utf8'),
  readFile('functions/package.json', 'utf8'),
  readFile('functions/package-lock.json', 'utf8'),
  readFile('package.json', 'utf8'),
])

for (const name of functionExports) {
  assert.ok(functionsIndex.includes(`exports.${name} = createOrderCommandCallable`), `functions/index.js should export ${name}`)
}

for (const token of [
  'assertStoreAccess',
  'loadTableForAccess',
  'loadOrderItemForAccess',
  'assertOrderItemTargetsAccess',
]) {
  assert.ok(auth.includes(token), `functions/orderCommandAuth.js should include ${token}`)
}

for (const token of [
  'startCustomerOrderSession',
  'submitCustomerOrderItems',
  'submitStaffOrderItems',
  'seatStaffOrderSession',
  'completeCheckoutCommand',
  'markOrderItemServedCommand',
  'markOrderItemsServedCommand',
  'markOrderItemOrderedCommand',
  'cancelOrderItemCommand',
  'moveTableOrderCommand',
  'guideReservationToTableCommand',
]) {
  assert.ok(handlers.includes(token), `functions/orderCommandHandlers.js should include ${token}`)
}

assert.ok(api.includes("new HttpsError("), 'Functions command API should map command errors to callable errors')
assert.ok(api.includes("ORDER_COMMAND_REGION = 'us-central1'"), 'Functions command API should pin order callables to us-central1')
assert.ok(api.includes('options.region'), 'Functions command API should allow an explicit regional alias')
assert.ok(api.includes('category-scope-mismatch'), 'Functions command API should map category scope errors')
assert.ok(handlers.includes('category-scope-mismatch') && handlers.includes('category.storeId'), 'Functions handlers should reject cross-store categories')
assert.ok(clientRuntime.includes("VITE_ORDER_COMMAND_RUNTIME"), 'client command runtime should read VITE_ORDER_COMMAND_RUNTIME')
assert.ok(clientRuntime.includes('import.meta.env.PROD'), 'client command runtime should default Production builds to Functions')
assert.ok(clientRuntime.includes("ORDER_COMMAND_RUNTIME === 'client'"), 'client command runtime should support explicit client rollback')
assert.ok(clientRuntime.includes("ORDER_COMMAND_RUNTIME === 'functions'"), 'client command runtime should support explicit Functions verification')

assert.match(
  rules,
  /function legacyPublicOrderWritesAllowed\(\) \{[\s\S]*?return false;/,
  'legacy public order writes should be locked down after Functions mainline'
)
assert.ok(
  rules.includes('match /orders/{orderId}') && rules.includes('allow create: if legacyPublicOrderWritesAllowed();'),
  'orders create rule must route through the compatibility helper during migration'
)
assert.ok(
  rules.includes('match /orderItems/{itemId}') && rules.includes('allow create: if legacyPublicOrderWritesAllowed();'),
  'orderItems create rule must route through the compatibility helper during migration'
)

const firebase = JSON.parse(firebaseJson)
const functionsPkg = JSON.parse(functionsPackage)
const functionsPkgLock = JSON.parse(functionsLock)
const rootPkg = JSON.parse(packageJson)
assert.equal(firebase.functions?.runtime, 'nodejs22', 'firebase.json Functions runtime should be nodejs22')
assert.equal(functionsPkg.engines?.node, '22', 'functions/package.json engine should match nodejs22')
assert.equal(functionsPkgLock.packages?.['']?.engines?.node, '22', 'functions/package-lock.json engine should match nodejs22')
assert.ok(rootPkg.scripts?.['check:order-functions-emulator']?.includes('check-order-functions-emulator.mjs'), 'package.json should expose the Functions emulator concurrency check')
assert.ok(functionsIndex.includes("ASIA_NORTHEAST_FUNCTION_REGION = 'asia-northeast1'"), 'Functions index should pin existing asia-northeast1 triggers')
assert.ok(functionsIndex.includes("US_CENTRAL_FUNCTION_REGION = 'us-central1'"), 'Functions index should pin existing us-central1 triggers')
assert.ok(functionsIndex.includes('region: ASIA_NORTHEAST_FUNCTION_REGION'), 'Functions index should use the asia-northeast1 trigger region')
assert.ok(functionsIndex.includes('region: US_CENTRAL_FUNCTION_REGION'), 'Functions index should use the us-central1 trigger region')
for (const name of ['submitCustomerOrderItemsCommandAsia', 'submitStaffOrderItemsCommandAsia']) {
  const exportStart = functionsIndex.indexOf(`exports.${name} = createOrderCommandCallable`)
  assert.notEqual(exportStart, -1, `${name} should be exported`)
  const exportBlock = functionsIndex.slice(exportStart, exportStart + 400)
  assert.ok(exportBlock.includes('region: ASIA_NORTHEAST_FUNCTION_REGION'), `${name} should use asia-northeast1`)
  assert.ok(!exportBlock.includes('minInstances'), `${name} should remain scale-to-zero`)
}
assert.ok(api.includes('const ORDER_COMMAND_MAX_INSTANCES = 20'), 'all order callables should cap max instances at 20')
assert.ok(
  api.includes('options.maxInstances ?? ORDER_COMMAND_MAX_INSTANCES'),
  'order callable factory should default to the production max instance cap',
)
assert.ok(api.includes('const callableOptions = { cors: true, region, maxInstances }'), 'order callable manifest should always include the scale cap')

console.log('functions/rules migration checks passed')
