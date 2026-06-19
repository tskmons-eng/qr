import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const functionExports = [
  'startCustomerOrderSessionCommand',
  'submitCustomerOrderItemsCommand',
  'submitStaffOrderItemsCommand',
  'seatStaffOrderSessionCommand',
  'completeCheckoutCommand',
  'markOrderItemServedCommand',
  'markOrderItemsServedCommand',
  'markOrderItemOrderedCommand',
  'cancelOrderItemCommand',
  'moveTableOrderCommand',
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
]) {
  assert.ok(handlers.includes(token), `functions/orderCommandHandlers.js should include ${token}`)
}

assert.ok(api.includes("new HttpsError("), 'Functions command API should map command errors to callable errors')
assert.ok(clientRuntime.includes("VITE_ORDER_COMMAND_RUNTIME"), 'client command runtime should read VITE_ORDER_COMMAND_RUNTIME')
assert.ok(clientRuntime.includes('import.meta.env.PROD'), 'client command runtime should default Production builds to Functions')
assert.ok(clientRuntime.includes("ORDER_COMMAND_RUNTIME === 'client'"), 'client command runtime should support explicit client rollback')
assert.ok(clientRuntime.includes("ORDER_COMMAND_RUNTIME === 'functions'"), 'client command runtime should support explicit Functions verification')

assert.match(
  rules,
  /function legacyPublicOrderWritesAllowed\(\) \{[\s\S]*?return true;/,
  'legacy public order writes must remain compatible during migration'
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
assert.equal(firebase.functions?.runtime, 'nodejs20', 'firebase.json Functions runtime should be nodejs20')
assert.equal(functionsPkg.engines?.node, '20', 'functions/package.json engine should match nodejs20')
assert.equal(functionsPkgLock.packages?.['']?.engines?.node, '20', 'functions/package-lock.json engine should match nodejs20')

console.log('functions/rules migration checks passed')
