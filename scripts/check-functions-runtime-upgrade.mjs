import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'

const TARGETS = Object.freeze({
  admin: '13.10.0',
  functions: '7.2.5',
  engine: '22',
  runtime: 'nodejs22',
})
const expectedNodeMajor = process.env.QR_EXPECT_NODE_MAJOR

if (expectedNodeMajor) {
  assert.equal(
    process.versions.node.split('.')[0],
    expectedNodeMajor,
    `runtime upgrade gate should execute on Node.js ${expectedNodeMajor}`,
  )
}

const [
  firebaseText,
  functionsPackageText,
  functionsLockText,
  rootPackageText,
  plan,
  runbook,
  functionFiles,
] = await Promise.all([
  readFile('firebase.json', 'utf8'),
  readFile('functions/package.json', 'utf8'),
  readFile('functions/package-lock.json', 'utf8'),
  readFile('package.json', 'utf8'),
  readFile('plan.MD', 'utf8'),
  readFile('docs/order-reliability/13-functions-node22-upgrade.md', 'utf8'),
  readdir('functions'),
])

const functionSources = (await Promise.all(
  functionFiles
    .filter(file => file.endsWith('.js'))
    .map(file => readFile(`functions/${file}`, 'utf8')),
)).join('\n')
const [functionsIndex, orderCommandApi] = await Promise.all([
  readFile('functions/index.js', 'utf8'),
  readFile('functions/orderCommandApi.js', 'utf8'),
])

function exportBlock(source, exportName) {
  const start = source.indexOf(`exports.${exportName} =`)
  assert.notEqual(start, -1, `${exportName} should remain exported`)
  const next = source.indexOf('\nexports.', start + 1)
  return source.slice(start, next === -1 ? source.length : next)
}

const firebase = JSON.parse(firebaseText)
const functionsPackage = JSON.parse(functionsPackageText)
const functionsLock = JSON.parse(functionsLockText)
const rootPackage = JSON.parse(rootPackageText)
const lockRoot = functionsLock.packages?.['']
const lockedFunctions = functionsLock.packages?.['node_modules/firebase-functions']
const lockedAdmin = functionsLock.packages?.['node_modules/firebase-admin']

assert.equal(firebase.functions?.runtime, TARGETS.runtime, 'Firebase Functions runtime should be Node.js 22')
assert.equal(functionsPackage.engines?.node, TARGETS.engine, 'Functions package engine should be Node.js 22')
assert.equal(lockRoot?.engines?.node, TARGETS.engine, 'Functions lock root should preserve the Node.js 22 engine')

assert.equal(functionsPackage.dependencies?.['firebase-functions'], TARGETS.functions, 'firebase-functions should be pinned to the reviewed stable version')
assert.equal(functionsPackage.dependencies?.['firebase-admin'], TARGETS.admin, 'firebase-admin should be pinned to the reviewed compatible version')
assert.equal(lockRoot?.dependencies?.['firebase-functions'], TARGETS.functions, 'lock root should pin firebase-functions')
assert.equal(lockRoot?.dependencies?.['firebase-admin'], TARGETS.admin, 'lock root should pin firebase-admin')
assert.equal(lockedFunctions?.version, TARGETS.functions, 'lockfile should resolve firebase-functions exactly')
assert.equal(lockedAdmin?.version, TARGETS.admin, 'lockfile should resolve firebase-admin exactly')
assert.match(
  lockedFunctions?.peerDependencies?.['firebase-admin'] ?? '',
  /\^13\.0\.0/,
  'firebase-functions peer range should explicitly support Admin SDK 13',
)

assert.match(functionSources, /firebase-functions\/v2\//, 'Functions should keep explicit v2 trigger imports')
assert.match(functionSources, /firebase-admin\/(app|firestore|messaging)/, 'Admin SDK should use modular subpath imports')
assert.doesNotMatch(functionSources, /require\(['"]firebase-functions['"]\)/, 'legacy firebase-functions root import should not return')
assert.doesNotMatch(functionSources, /require\(['"]firebase-admin['"]\)/, 'legacy firebase-admin namespace import should not return')
assert.doesNotMatch(functionSources, /functions\.config\s*\(/, 'removed functions.config API should not be used')
for (const removedMessagingApi of [
  'sendAll',
  'sendMulticast',
  'sendToDevice',
  'sendToDeviceGroup',
  'sendToTopic',
  'sendToCondition',
]) {
  assert.ok(!functionSources.includes(`.${removedMessagingApi}(`), `${removedMessagingApi} should not return after Admin SDK 13 upgrade`)
}
assert.ok(functionSources.includes('.sendEachForMulticast('), 'current multicast API should remain in use')

const orderCallableNames = [
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
for (const name of orderCallableNames) {
  assert.ok(
    exportBlock(functionsIndex, name).includes('createOrderCommandCallable'),
    `${name} should use the capped callable factory`,
  )
}
assert.ok(orderCommandApi.includes('const ORDER_COMMAND_MAX_INSTANCES = 20'), 'order callable maxInstances should match production')
assert.ok(
  orderCommandApi.includes('options.maxInstances ?? ORDER_COMMAND_MAX_INSTANCES'),
  'order callable maxInstances should default to the production cap while preserving overrides',
)
assert.ok(
  orderCommandApi.includes('const callableOptions = { cors: true, region, maxInstances }'),
  'order callable manifests should always include maxInstances',
)

assert.ok(functionsIndex.includes('const EVENT_TRIGGER_MAX_INSTANCES = 20'), 'capped event triggers should match production')
for (const name of [
  'syncTablePendingAggregateOnCreate',
  'syncTablePendingAggregateOnUpdate',
  'syncTablePendingAggregateOnDelete',
  'notifyStaff',
]) {
  assert.ok(
    exportBlock(functionsIndex, name).includes('maxInstances: EVENT_TRIGGER_MAX_INSTANCES'),
    `${name} should preserve its production maxInstances`,
  )
}
for (const name of ['notifyReservationCreated', 'processReservationArrivals']) {
  assert.ok(!exportBlock(functionsIndex, name).includes('maxInstances'), `${name} should preserve its uncapped production setting`)
}
assert.doesNotMatch(functionSources, /preserveExternalChanges/, 'runtime settings should remain source-controlled')

assert.equal(
  rootPackage.scripts?.['check:functions-runtime-upgrade'],
  'node scripts/check-functions-runtime-upgrade.mjs',
  'package.json should expose the runtime upgrade guard',
)
assert.ok(rootPackage.scripts?.check?.includes('check:functions-runtime-upgrade'), 'full check should include the runtime upgrade guard')

for (const token of [
  'Cloud Functions Node.js 22 / SDK更新',
  '`firebase-functions 7.2.5`',
  '`firebase-admin 13.10.0`',
  'Functions全体deployは行わない',
]) {
  assert.ok(plan.includes(token), `plan.MD should document ${token}`)
}
for (const token of [
  'nodejs22',
  'firebase-functions 7.2.5',
  'firebase-admin 13.10.0',
  'submitCustomerOrderItemsCommandAsia',
  'Functions全体deployは禁止',
]) {
  assert.ok(runbook.includes(token), `Node.js 22 runbook should document ${token}`)
}

console.log(`Functions Node.js 22 runtime upgrade checks passed on Node ${process.version}`)
