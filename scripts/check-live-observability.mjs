import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [
  functionsIndex,
  api,
  failureRecorder,
  shared,
  auditScript,
  docs,
  readme,
  packageJson,
] = await Promise.all([
  readFile('functions/index.js', 'utf8'),
  readFile('functions/orderCommandApi.js', 'utf8'),
  readFile('functions/orderCommandFailures.js', 'utf8'),
  readFile('functions/orderCommandShared.js', 'utf8'),
  readFile('scripts/audit-order-command-failures.mjs', 'utf8'),
  readFile('docs/order-reliability/09-live-observability.md', 'utf8'),
  readFile('docs/order-reliability/README.md', 'utf8'),
  readFile('package.json', 'utf8'),
])

for (const token of [
  'recordOrderCommandFailure',
  'buildOrderCommandFailureContext',
  'throw toHttpsError(error)',
]) {
  assert.ok(api.includes(token), `functions/orderCommandApi.js should include ${token}`)
}

for (const token of [
  'orderCommandFailures',
  'commandType',
  'actorType',
  'storeId',
  'tableId',
  'targetTableId',
  'orderId',
  'itemId',
  'clientRequestId',
  'errorCode',
  'errorName',
  'errorMessage',
  'orderCommandVersion',
  'FieldValue.serverTimestamp()',
]) {
  assert.ok(failureRecorder.includes(token), `functions/orderCommandFailures.js should include ${token}`)
}

assert.ok(!failureRecorder.includes('activeStaff'), 'server failure logs should not store activeStaff payloads')
assert.ok(!failureRecorder.includes('guestAutoAdd'), 'server failure logs should not store customer/menu payloads')
assert.ok(!failureRecorder.includes('receivedCash'), 'server failure logs should not store checkout cash fields')

for (const token of [
  "commandType: 'start_customer_order_session'",
  "commandType: 'customer_submit_items'",
  "commandType: 'staff_submit_items'",
  "commandType: 'complete_checkout'",
  "commandType: 'move_table_order'",
]) {
  assert.ok(functionsIndex.includes(token), `functions/index.js should wire ${token}`)
}

assert.ok(shared.includes('error.orderCommandContext = context'), 'Functions command errors should support narrow context')
assert.ok(auditScript.includes("collection('orderCommandFailures')"), 'audit script should read orderCommandFailures')
assert.ok(!/\.add\(|\.set\(|\.update\(|\.delete\(|runTransaction|writeBatch/.test(auditScript), 'failure audit script must be read-only')
assert.ok(docs.includes('npm run audit:command-failures'), '09 doc should include command failure audit command')
assert.ok(docs.includes('npm run audit:pending-counts -- --json'), '09 doc should include pending drift audit command')
assert.ok(readme.includes('orderCommandFailures'), 'README should mention orderCommandFailures observability')

const pkg = JSON.parse(packageJson)
assert.equal(pkg.scripts['audit:command-failures'], 'node scripts/audit-order-command-failures.mjs')
assert.equal(pkg.scripts['check:live-observability'], 'node scripts/check-live-observability.mjs')
assert.ok(pkg.scripts.check.includes('check:live-observability'), 'npm run check should include live observability check')

console.log('live observability checks passed')
