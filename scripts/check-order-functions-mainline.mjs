import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const callableNames = [
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
  'guideReservationToTableCommand',
]

const [
  runtimeSource,
  orderCommandService,
  orderItemCommandService,
  tableMoveCommandService,
  reservationService,
  functionsIndex,
  functionsApi,
  envExample,
  roundTwoDoc,
] = await Promise.all([
  readFile('src/services/orderFunctionCommandService.js', 'utf8'),
  readFile('src/services/orderCommandService.js', 'utf8'),
  readFile('src/services/orderItemCommandService.js', 'utf8'),
  readFile('src/services/tableMoveCommandService.js', 'utf8'),
  readFile('src/services/reservationService.js', 'utf8'),
  readFile('functions/index.js', 'utf8'),
  readFile('functions/orderCommandApi.js', 'utf8'),
  readFile('.env.local.example', 'utf8'),
  readFile('docs/order-reliability/06-functions-mainline.md', 'utf8'),
])

assert.ok(runtimeSource.includes('const IS_PRODUCTION_BUILD = import.meta.env.PROD'), 'runtime should read Vite Production flag')
assert.ok(runtimeSource.includes("if (ORDER_COMMAND_RUNTIME === 'client') return false"), 'explicit client runtime should be the rollback path')
assert.ok(runtimeSource.includes("if (ORDER_COMMAND_RUNTIME === 'functions') return true"), 'explicit Functions runtime should remain available for verification')
assert.ok(runtimeSource.includes('return IS_PRODUCTION_BUILD'), 'unset runtime should use Functions only in Production builds')

const clientFallbackTokens = [
  'startCustomerOrderSessionClient',
  'submitCustomerOrderItemsClient',
  'submitStaffOrderItemsClient',
  'seatStaffOrderSessionClient',
  'completeCheckoutClient',
  'updateItemsToServed',
  'runTransaction',
]

for (const token of clientFallbackTokens) {
  assert.ok(
    orderCommandService.includes(token) || orderItemCommandService.includes(token) || tableMoveCommandService.includes(token),
    `client rollback path should keep ${token}`
  )
}

const serviceSources = [orderCommandService, orderItemCommandService, tableMoveCommandService, reservationService].join('\n')
for (const callableName of callableNames) {
  assert.ok(functionsIndex.includes(`exports.${callableName} = createOrderCommandCallable`), `Functions should export ${callableName}`)
  assert.ok(serviceSources.includes(`callOrderCommandFunction('${callableName}'`), `client wrappers should call ${callableName}`)
}

assert.ok(envExample.includes('Production builds default to Functions commands.'), '.env.local.example should document Production default')
assert.ok(envExample.includes('VITE_ORDER_COMMAND_RUNTIME=client'), '.env.local.example should keep local rollback override visible')
assert.ok(roundTwoDoc.includes('Production build では Functions command を既定経路にする。'), '06 doc should define Functions as Production default')
assert.ok(functionsApi.includes("ORDER_COMMAND_REGION = 'us-central1'"), 'order callable region should match the default client Functions region')
assert.ok(roundTwoDoc.includes('注文 callable は `us-central1`'), '06 doc should mention the order callable region')

console.log('order Functions mainline checks passed')
