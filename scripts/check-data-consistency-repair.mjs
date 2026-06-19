import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const files = {
  audit: await readFile('scripts/audit-pending-counts.mjs', 'utf8'),
  repair: await readFile('scripts/repair-pending-counts.mjs', 'utf8'),
  shared: await readFile('scripts/lib/pending-count-audit.mjs', 'utf8'),
  packageJson: await readFile('package.json', 'utf8'),
  docs10: await readFile('docs/order-reliability/10-data-consistency-repair.md', 'utf8'),
}

function assertIncludes(name, text, token) {
  assert.ok(text.includes(token), `${name} should include ${token}`)
}

for (const [name, text] of Object.entries(files)) {
  assert.ok(!/deleteDoc|batch\.delete|\.delete\(|delete\(/.test(text), `${name} should not delete Firestore data`)
}

assertIncludes('package.json', files.packageJson, '"repair:pending-counts": "node scripts/repair-pending-counts.mjs"')
assertIncludes('package.json', files.packageJson, '"check:data-consistency-repair": "node scripts/check-data-consistency-repair.mjs"')
assertIncludes('repair script', files.repair, "if (!options.storeId) throw new Error('--store <storeId> is required for repair safety.')")
assertIncludes('repair script', files.repair, "arg === '--apply'")
assertIncludes('repair script', files.repair, "mode: options.apply ? 'applied' : 'dry-run'")
assertIncludes('shared repair', files.shared, "const tableRef = db.collection('tables').doc(repair.tableId)")
assertIncludes('shared repair', files.shared, 'transaction.update(tableRef, repair.after)')
assertIncludes('shared repair', files.shared, 'pendingAggregateVersion: TABLE_PENDING_AGGREGATE_VERSION')
assertIncludes('10 doc', files.docs10, '修復 script は dry-run が既定')
assertIncludes('10 doc', files.docs10, '`--store <storeId>` を必須')

const protectedCollections = [
  'orders',
  'orderItems',
  'checks',
  'staffActions',
  'products',
  'categories',
  'optionTemplates',
  'tagTemplates',
  'reservations',
]

for (const collection of protectedCollections) {
  assert.ok(
    !files.shared.includes(`db.collection('${collection}').doc`) || collection === 'orderItems',
    `shared repair code should not address ${collection} docs for writes`
  )
}

console.log('data consistency repair checks passed')
