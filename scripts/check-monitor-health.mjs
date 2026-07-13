import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  buildPendingFingerprint,
  classifyFailureAudit,
  classifyPendingAudit,
  combineLevels,
  sanitizeFailureAudit,
} from './lib/health-monitor.mjs'

const [runner, budget, baselineText, runbook, plan, packageText] = await Promise.all([
  readFile('scripts/monitor-health.mjs', 'utf8'),
  readFile('scripts/check-performance-budget.mjs', 'utf8'),
  readFile('scripts/monitor-health-baseline.json', 'utf8'),
  readFile('docs/order-safety-round3/live-failure-monitoring-runbook.md', 'utf8'),
  readFile('plan.MD', 'utf8'),
  readFile('package.json', 'utf8'),
])

const baseline = JSON.parse(baselineText)
const pkg = JSON.parse(packageText)

assert.equal(pkg.scripts['monitor:health'], 'node scripts/monitor-health.mjs')
assert.equal(pkg.scripts['monitor:health:deep'], 'node scripts/monitor-health.mjs --deep')
assert.equal(pkg.scripts['check:monitor-health'], 'node scripts/check-monitor-health.mjs')
assert.equal(pkg.scripts['check:performance-budget'], 'node scripts/check-performance-budget.mjs')
assert.ok(pkg.scripts.check.includes('check:monitor-health'), 'npm run check should include monitor health contracts')
assert.ok(runner.includes('const stepResults = [git, check, build, performance'), 'git status failure should fail the monitor')
assert.ok(!runner.includes('result.stderr || result.stdout'), 'monitor failures must not echo unsanitized command output')

for (const forbidden of ['repair:pending-counts', '--apply', 'firebase deploy', 'git push', 'git commit']) {
  assert.ok(!runner.includes(forbidden), `health monitor must not include mutating command: ${forbidden}`)
}
for (const required of [
  'audit-order-command-failures.mjs',
  'audit-pending-counts.mjs',
  'check-performance-budget.mjs',
  'check:order-functions-emulator',
  'https://qrproduct-3340b.web.app',
]) {
  assert.ok(runner.includes(required), `health monitor should include ${required}`)
}

assert.equal(baseline.version, 1)
assert.equal(baseline.pending.driftedTableCount, 7)
assert.equal(baseline.pending.itemIssueCount, 0)
assert.match(baseline.pending.fingerprint, /^sha256:[a-f0-9]{64}$/)
assert.ok(!/storeId|tableId|orderId|clientRequestId/.test(baselineText), 'baseline must not contain production identifiers')

const failureAudit = {
  window: { minutes: 60 },
  summary: {
    total: 1,
    byErrorCode: { internal: 1 },
    byCommandType: { customer_submit_items: 1 },
    byStoreId: { secretStore: 1 },
    diagnosisSignals: ['isolated_or_mixed_failures'],
  },
  rows: [{ storeId: 'secretStore', tableId: 'secretTable', orderId: 'secretOrder', clientRequestId: 'secretRequest' }],
}
const safeFailure = sanitizeFailureAudit(failureAudit)
assert.equal(safeFailure.total, 1)
assert.equal(classifyFailureAudit(failureAudit).level, 'WARN')
assert.ok(!/secret|storeId|tableId|orderId|clientRequestId|rows/.test(JSON.stringify(safeFailure)))

const clusteredFailure = structuredClone(failureAudit)
clusteredFailure.summary.total = 3
clusteredFailure.summary.byErrorCode.internal = 3
clusteredFailure.summary.diagnosisSignals = ['functions_constant_error_possible:internal']
assert.equal(classifyFailureAudit(clusteredFailure).level, 'FAIL')
assert.equal(classifyFailureAudit({ summary: { total: 0, diagnosisSignals: ['no_failure_log_in_window'] } }).level, 'PASS')

const pendingAudit = {
  summary: { tableCount: 2, pendingItemCount: 2, driftedTableCount: 1, itemIssueCount: 0 },
  driftedTables: [{
    tableId: 'secretTable',
    storeId: 'secretStore',
    status: 'vacant',
    issues: ['legacy_pending_total'],
    actual: { total: 1, drink: 0, food: 1 },
    legacy: { total: 0, drink: 0, food: 0 },
    aggregate: { total: 1, drink: 0, food: 1 },
    aggregateVersion: 1,
  }],
  itemIssues: [],
}
const syntheticBaseline = {
  pending: {
    driftedTableCount: 1,
    itemIssueCount: 0,
    fingerprint: buildPendingFingerprint(pendingAudit),
  },
}
assert.equal(classifyPendingAudit(pendingAudit, syntheticBaseline).level, 'KNOWN')
const replacedPending = structuredClone(pendingAudit)
replacedPending.driftedTables[0].tableId = 'anotherSecretTable'
assert.equal(classifyPendingAudit(replacedPending, syntheticBaseline).level, 'FAIL')
const resolvedPending = { summary: { tableCount: 2, pendingItemCount: 0, driftedTableCount: 0, itemIssueCount: 0 }, driftedTables: [], itemIssues: [] }
assert.equal(classifyPendingAudit(resolvedPending, syntheticBaseline).level, 'PASS')

assert.equal(combineLevels(['PASS', 'KNOWN']), 'PASS')
assert.equal(combineLevels(['PASS', 'WARN']), 'WARN')
assert.equal(combineLevels(['WARN', 'FAIL']), 'FAIL')

for (const token of [
  'npm run monitor:health',
  'npm run monitor:health:deep',
  '監視自身はbaselineを更新しない',
  '店舗・席・注文・request IDを出力しない',
]) {
  assert.ok(runbook.includes(token), `monitoring runbook should include ${token}`)
}
assert.ok(plan.includes('手動ヘルス監視と初回読込性能改善'))
assert.ok(budget.includes('MAX_INITIAL_JS_GZIP'))
assert.ok(budget.includes('BANNED_INITIAL_CHUNKS'))

console.log('manual health monitor contract checks passed')
