import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [
  functionsIndex,
  api,
  handlers,
  failureRecorder,
  shared,
  auditScript,
  docs,
  runbook,
  round3Doc,
  readme,
  packageJson,
] = await Promise.all([
  readFile('functions/index.js', 'utf8'),
  readFile('functions/orderCommandApi.js', 'utf8'),
  readFile('functions/orderCommandHandlers.js', 'utf8'),
  readFile('functions/orderCommandFailures.js', 'utf8'),
  readFile('functions/orderCommandShared.js', 'utf8'),
  readFile('scripts/audit-order-command-failures.mjs', 'utf8'),
  readFile('docs/order-reliability/09-live-observability.md', 'utf8'),
  readFile('docs/order-safety-round3/live-failure-monitoring-runbook.md', 'utf8'),
  readFile('docs/order-safety-round3/05-live-failure-monitoring-and-repair.md', 'utf8'),
  readFile('docs/order-reliability/README.md', 'utf8'),
  readFile('package.json', 'utf8'),
])

for (const token of [
  'recordOrderCommandFailure',
  'buildOrderCommandFailureContext',
  'throw toHttpsError(error',
]) {
  assert.ok(api.includes(token), `functions/orderCommandApi.js should include ${token}`)
}

for (const token of [
  "event: 'order_command_completed'",
  'commandType:',
  'actorType:',
  'region,',
  'durationMs:',
  'deduped:',
]) {
  assert.ok(api.includes(token), `Functions success log should include ${token}`)
}
for (const token of [
  "event: 'order_command_stage_completed'",
  "'product_verification'",
  "'transaction'",
  'itemCount,',
]) {
  assert.ok(handlers.includes(token), `Functions stage log should include ${token}`)
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

for (const token of [
  '--minutes',
  '--table',
  '--order',
  '--client-request-id',
  'clientRequestId',
  'diagnosisSignals',
  'functions_constant_error_possible',
  'rules_or_permission_error_seen',
]) {
  assert.ok(auditScript.includes(token), `failure audit script should include ${token}`)
}

assert.ok(docs.includes('npm run audit:command-failures'), '09 doc should include command failure audit command')
assert.ok(docs.includes('--minutes 15'), '09 doc should include 15 minute failure audit command')
assert.ok(docs.includes('--minutes 60'), '09 doc should include 60 minute failure audit command')
assert.ok(docs.includes('npm run audit:pending-counts -- --json'), '09 doc should include pending drift audit command')
assert.ok(docs.includes('live-failure-monitoring-runbook.md'), '09 doc should link the live failure runbook')
assert.ok(docs.includes('order_command_completed'), '09 doc should document anonymous total duration logs')
assert.ok(docs.includes('order_command_stage_completed'), '09 doc should document anonymous stage duration logs')
assert.ok(readme.includes('orderCommandFailures'), 'README should mention orderCommandFailures observability')

for (const token of [
  'npm run audit:command-failures -- --minutes 15',
  'npm run audit:command-failures -- --minutes 60 --store <storeId>',
  'npm run audit:command-failures -- --client-request-id <clientRequestId>',
  'npm run audit:pending-counts -- --store <storeId> --json',
  'npm run repair:pending-counts -- --store <storeId>',
  'dry-run',
  'functions:log --project qrproduct-3340b --lines 100',
  'permission-denied',
  'unauthenticated',
  'failed-precondition',
  '顧客端末/通信だけの問題',
  'Functions側の恒常エラー',
  'rules/権限エラー',
  'データ不整合',
]) {
  assert.ok(runbook.includes(token), `live failure runbook should include ${token}`)
}

assert.ok(round3Doc.includes('新規 runbook MD'), 'round3 item 05 should still define runbook scope')
assert.ok(round3Doc.includes('live-failure-monitoring-runbook.md'), 'round3 item 05 should report the live failure runbook')

const pkg = JSON.parse(packageJson)
assert.equal(pkg.scripts['audit:command-failures'], 'node scripts/audit-order-command-failures.mjs')
assert.equal(pkg.scripts['check:live-observability'], 'node scripts/check-live-observability.mjs')
assert.ok(pkg.scripts.check.includes('check:live-observability'), 'npm run check should include live observability check')

console.log('live observability checks passed')
