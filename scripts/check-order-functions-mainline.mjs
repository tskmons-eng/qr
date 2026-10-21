import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const directCallableNames = [
  'startCustomerOrderSessionCommand',
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

// 2026-10-22 整理 第4章：ブラウザから直接書く予備（client rollback）は廃止。常に Functions を通す。
assert.ok(!runtimeSource.includes('ORDER_COMMAND_RUNTIME'), 'direct-write runtime switch should stay removed')
for (const token of ['startCustomerOrderSessionClient', 'submitCustomerOrderItemsClient', 'submitStaffOrderItemsClient', 'seatStaffOrderSessionClient', 'completeCheckoutClient', 'updateItemsToServed', 'runTransaction', 'shouldUseOrderCommandFunctions']) {
  assert.ok(
    !orderCommandService.includes(token) && !orderItemCommandService.includes(token) && !tableMoveCommandService.includes(token),
    `client direct-write path should stay removed: ${token}`
  )
}

const serviceSources = [orderCommandService, orderItemCommandService, tableMoveCommandService, reservationService].join('\n')
for (const callableName of directCallableNames) {
  assert.ok(functionsIndex.includes(`exports.${callableName} = createOrderCommandCallable`), `Functions should export ${callableName}`)
  assert.ok(serviceSources.includes(`callOrderCommandFunction('${callableName}'`), `client wrappers should call ${callableName}`)
}

for (const [asiaName, usName] of [
  ['submitCustomerOrderItemsCommandAsia', 'submitCustomerOrderItemsCommand'],
  ['submitStaffOrderItemsCommandAsia', 'submitStaffOrderItemsCommand'],
]) {
  assert.ok(functionsIndex.includes(`exports.${usName} = createOrderCommandCallable`), `Functions should keep US rollback export ${usName}`)
  assert.ok(functionsIndex.includes(`exports.${asiaName} = createOrderCommandCallable`), `Functions should export Asia submit alias ${asiaName}`)
  assert.ok(orderCommandService.includes(`'${asiaName}'`), `client wrapper should call ${asiaName} first`)
  assert.ok(orderCommandService.includes(`'${usName}'`), `client wrapper should retain ${usName} fallback`)
}
assert.ok(orderCommandService.includes('callRegionalOrderSubmitFunction'), 'submit wrappers should use regional routing helper')

assert.ok(!envExample.includes('VITE_ORDER_COMMAND_RUNTIME'), '.env.local.example should not offer the removed direct-write mode')
assert.ok(roundTwoDoc.includes('Production build では Functions command を既定経路にする。'), '06 doc should define Functions as Production default')
assert.ok(functionsApi.includes("ORDER_COMMAND_REGION = 'us-central1'"), 'order callable region should match the default client Functions region')
assert.ok(roundTwoDoc.includes('注文 callable は `us-central1`'), '06 doc should mention the order callable region')
assert.ok(roundTwoDoc.includes('東京別名Callable'), '06 doc should document the Asia submit priority')

console.log('order Functions mainline checks passed')
