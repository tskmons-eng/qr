import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [
  functionsIndex,
  functionsApi,
  handlers,
  functionRuntime,
  orderCommandService,
  latencyDoc,
  packageJson,
] = await Promise.all([
  readFile('functions/index.js', 'utf8'),
  readFile('functions/orderCommandApi.js', 'utf8'),
  readFile('functions/orderCommandHandlers.js', 'utf8'),
  readFile('src/services/orderFunctionCommandService.js', 'utf8'),
  readFile('src/services/orderCommandService.js', 'utf8'),
  readFile('docs/order-reliability/12-free-order-submit-latency.md', 'utf8'),
  readFile('package.json', 'utf8'),
])

function sliceBetween(source, startToken, endToken) {
  const start = source.indexOf(startToken)
  assert.notEqual(start, -1, `source should include ${startToken}`)
  const end = source.indexOf(endToken, start + startToken.length)
  assert.notEqual(end, -1, `source should include ${endToken} after ${startToken}`)
  return source.slice(start, end)
}

function extractFunction(source, functionName) {
  const marker = `function ${functionName}`
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `source should include ${marker}`)
  const signatureMatch = source.slice(start).match(/^function\s+\w+\s*\([\s\S]*?\)\s*\{/)
  assert.ok(signatureMatch, `${functionName} should have a function signature`)
  const bodyStart = start + signatureMatch[0].lastIndexOf('{')

  let depth = 0
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') depth -= 1
    if (depth === 0) return source.slice(start, index + 1)
  }
  assert.fail(`${functionName} body should be closed`)
}

for (const name of [
  'submitCustomerOrderItemsCommand',
  'submitStaffOrderItemsCommand',
]) {
  assert.ok(
    functionsIndex.includes(`exports.${name} = createOrderCommandCallable`),
    `existing US callable ${name} should remain available as rollback`,
  )
}

for (const name of [
  'submitCustomerOrderItemsCommandAsia',
  'submitStaffOrderItemsCommandAsia',
]) {
  const aliasBlock = sliceBetween(
    functionsIndex,
    `exports.${name} = createOrderCommandCallable`,
    name === 'submitCustomerOrderItemsCommandAsia'
      ? 'exports.submitStaffOrderItemsCommand = createOrderCommandCallable'
      : 'exports.seatStaffOrderSessionCommand = createOrderCommandCallable',
  )
  assert.ok(aliasBlock.includes('region: ASIA_NORTHEAST_FUNCTION_REGION'), `${name} should run in asia-northeast1`)
  if (name === 'submitCustomerOrderItemsCommandAsia') {
    assert.ok(aliasBlock.includes('minInstances: CUSTOMER_ORDER_MIN_INSTANCES'), `${name} should keep one warm instance`)
  } else {
    assert.ok(!aliasBlock.includes('minInstances'), `${name} should remain scale-to-zero`)
  }
}

assert.ok(
  functionsApi.includes('function createOrderCommandCallable(handler, commandContext = {}, options = {})'),
  'callable factory should accept a narrow region option',
)
assert.ok(functionsApi.includes('const region = normalizeCallableRegion(options.region)'), 'callable region should be validated')
assert.ok(functionsApi.includes('const ORDER_COMMAND_MAX_INSTANCES = 20'), 'all order callables should preserve the production scale cap')
assert.ok(functionsApi.includes('options.maxInstances ?? ORDER_COMMAND_MAX_INSTANCES'), 'callable maxInstances should default to the production cap')
assert.ok(functionsApi.includes('const callableOptions = { cors: true, region, maxInstances }'), 'callable factory should always apply the scale cap')
assert.ok(functionsApi.includes('const minInstances = normalizeCallableMinInstances(options.minInstances)'), 'callable minInstances should be validated')
assert.ok(functionsApi.includes('if (minInstances !== undefined) callableOptions.minInstances = minInstances'), 'only explicit callables should reserve warm instances')
assert.ok(functionsApi.includes('return onCall(callableOptions'), 'callable factory should apply its selected options')

const productLoader = sliceBetween(
  handlers,
  'async function loadProductsWithCategoryGroups',
  'async function normalizeCartItemsWithProducts',
)
assert.ok(productLoader.includes('await db.getAll(...productRefs)'), 'product documents should be fetched in one Admin SDK batch')
assert.ok(productLoader.includes('await db.getAll(...categoryRefs)'), 'category documents should be fetched in one Admin SDK batch')

const customerSubmit = sliceBetween(
  handlers,
  'async function submitCustomerOrderItems',
  'async function submitStaffOrderItems',
)
const staffSubmit = sliceBetween(
  handlers,
  'async function submitStaffOrderItems',
  'async function seatStaffOrderSession',
)
assert.ok(customerSubmit.includes('transaction.getAll(itemRefs[0], orderRef)'), 'customer dedupe/order reads should be batched')
assert.ok(staffSubmit.includes('transaction.getAll(itemRefs[0], orderRef, tableRef)'), 'staff dedupe/order/table reads should be batched')
assert.ok(!customerSubmit.includes('await transaction.get('), 'customer submit should not restore sequential transaction document reads')
assert.ok(!staffSubmit.includes('await transaction.get('), 'staff submit should not restore sequential transaction document reads')

assert.ok(
  functionRuntime.includes("const ORDER_SUBMIT_PRIMARY_REGION = 'asia-northeast1'"),
  'client submit primary region should be asia-northeast1',
)
assert.ok(
  functionRuntime.includes("const ORDER_SUBMIT_FALLBACK_REGION = 'us-central1'"),
  'existing US callable fallback should stay pinned to its deployed region',
)

const fallbackSetMatch = functionRuntime.match(/const REGIONAL_FALLBACK_CODES = new Set\(\[[\s\S]*?\]\)/)
assert.ok(fallbackSetMatch, 'regional fallback should use an explicit allowlist')
const fallbackClassifierSource = [
  fallbackSetMatch[0],
  extractFunction(functionRuntime, 'normalizeCallableErrorCode'),
  extractFunction(functionRuntime, 'shouldFallbackToExistingSubmitCallable'),
  'return shouldFallbackToExistingSubmitCallable',
].join('\n')
const classifyFallback = Function(fallbackClassifierSource)()

for (const code of [
  'functions/unavailable',
  'functions/deadline-exceeded',
  'functions/internal',
  'functions/aborted',
  'functions/resource-exhausted',
  'functions/unknown',
  'functions/cancelled',
  'functions/not-found',
]) {
  assert.equal(classifyFallback({ code }), true, `${code} without a command error should permit US fallback`)
}

for (const error of [
  { code: 'functions/permission-denied' },
  { code: 'functions/invalid-argument' },
  { code: 'functions/failed-precondition' },
  { code: 'functions/not-found', details: { code: 'product-not-found' } },
  { code: 'functions/internal', details: { code: 'order-not-open' } },
]) {
  assert.equal(classifyFallback(error), false, `${error.code}/${error.details?.code ?? 'none'} must not retry a business or permission error`)
}
assert.equal(
  classifyFallback({ code: 'functions/internal', details: { code: 'unavailable' } }),
  true,
  'a callable error may fall back only when both outer and command codes are transient',
)

const regionalCaller = extractFunction(functionRuntime, 'callRegionalOrderSubmitFunction')
assert.ok(regionalCaller.includes('ORDER_SUBMIT_PRIMARY_REGION'), 'regional submit should call Asia first')
assert.ok(regionalCaller.includes('shouldFallbackToExistingSubmitCallable(error)'), 'regional submit should classify failures before fallback')
assert.ok(regionalCaller.includes('ORDER_SUBMIT_FALLBACK_REGION'), 'regional submit should call the US fallback second')
assert.ok((regionalCaller.match(/\bpayload\b/g) ?? []).length >= 3, 'Asia and US attempts should reuse the same payload and clientRequestId')

for (const [asiaName, usName] of [
  ['submitCustomerOrderItemsCommandAsia', 'submitCustomerOrderItemsCommand'],
  ['submitStaffOrderItemsCommandAsia', 'submitStaffOrderItemsCommand'],
]) {
  assert.ok(orderCommandService.includes('callRegionalOrderSubmitFunction'), 'submit service should use the regional helper')
  assert.ok(orderCommandService.includes(`'${asiaName}'`), `submit service should call ${asiaName} first`)
  assert.ok(orderCommandService.includes(`'${usName}'`), `submit service should retain ${usName} fallback`)
}

const totalLogBlock = sliceBetween(functionsApi, "info('Order command completed.'", 'return result')
const stageLogger = extractFunction(handlers, 'logOrderCommandStage')
for (const token of ['order_command_completed', 'commandType', 'actorType', 'region', 'durationMs', 'deduped']) {
  assert.ok(totalLogBlock.includes(token), `total duration log should include ${token}`)
}
for (const token of ['order_command_stage_completed', 'commandType', 'stage', 'durationMs', 'itemCount']) {
  assert.ok(stageLogger.includes(token), `stage duration log should include ${token}`)
}
for (const sensitiveKey of ['storeId', 'tableId', 'orderId', 'itemId', 'clientRequestId', 'uid']) {
  assert.ok(!totalLogBlock.includes(sensitiveKey), `success total log must not include ${sensitiveKey}`)
  assert.ok(!stageLogger.includes(sensitiveKey), `success stage log must not include ${sensitiveKey}`)
}
for (const stage of ['product_verification', 'transaction']) {
  assert.ok(customerSubmit.includes(`'${stage}'`), `customer submit should record ${stage} duration`)
  assert.ok(staffSubmit.includes(`'${stage}'`), `staff submit should record ${stage} duration`)
}

for (const token of [
  '月額の常駐費用を増やさない',
  'submitCustomerOrderItemsCommandAsia',
  'submitStaffOrderItemsCommandAsia',
  '同じ `clientRequestId`',
  '業務エラー・権限エラーでは fallback しない',
  '`minInstances` は追加しない',
  '`startCustomerOrderSessionCommand` と `submitCustomerOrderItemsCommandAsia` だけに `minInstances: 1`',
  '残り17本',
  '`maxInstances: 20`',
  'order_command_completed',
  'order_command_stage_completed',
]) {
  assert.ok(latencyDoc.includes(token), `latency runbook should document ${token}`)
}

const pkg = JSON.parse(packageJson)
assert.equal(pkg.scripts['check:order-latency-routing'], 'node scripts/check-order-latency-routing.mjs')
assert.ok(pkg.scripts.check.includes('check:order-latency-routing'), 'npm run check should include the free latency routing check')

console.log('order latency routing checks passed')
