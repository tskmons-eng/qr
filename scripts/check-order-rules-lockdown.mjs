import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [rules, doc08, doc11, packageJson] = await Promise.all([
  readFile('firestore.rules', 'utf8'),
  readFile('docs/order-reliability/08-rules-lockdown.md', 'utf8'),
  readFile('docs/order-reliability/11-integration-release.md', 'utf8'),
  readFile('package.json', 'utf8'),
])

function assertToken(source, token, label) {
  assert.ok(source.includes(token), `${label} should include ${token}`)
}

function countToken(source, token) {
  return source.split(token).length - 1
}

function extractBlock(source, marker) {
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `${marker} should exist`)
  const open = source.indexOf('{', start)
  assert.notEqual(open, -1, `${marker} should have an opening brace`)
  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    const char = source[index]
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, index + 1)
    }
  }
  throw new Error(`${marker} block was not closed`)
}

assert.match(
  rules,
  /function legacyPublicOrderWritesAllowed\(\) \{[\s\S]*?return true;/,
  'deploy-target rules should keep legacy public order writes open in compatibility stage'
)
assert.match(
  rules,
  /function legacyPublicTableOccupyAllowed\(\) \{[\s\S]*?return true;/,
  'deploy-target rules should keep legacy public table occupy open in compatibility stage'
)
assertToken(rules, 'legacyPublicTableOccupyRequest()', 'firestore.rules')
assert.equal(
  countToken(rules, 'allow create: if legacyPublicOrderWritesAllowed();'),
  2,
  'orders and orderItems create should both use the compatibility helper'
)
assertToken(rules, '|| legacyPublicTableOccupyRequest();', 'tables update rule')

assert.match(
  rules,
  /match \/orders\/\{orderId\} \{[\s\S]*?allow read: if true;[\s\S]*?allow create: if legacyPublicOrderWritesAllowed\(\);[\s\S]*?allow update: if canAccess\(resource\.data\.storeId\);/,
  'orders read/staff update permissions should remain intact'
)
assert.match(
  rules,
  /match \/orderItems\/\{itemId\} \{[\s\S]*?allow read: if true;[\s\S]*?allow create: if legacyPublicOrderWritesAllowed\(\);[\s\S]*?allow update: if canAccess\(resource\.data\.storeId\);/,
  'orderItems read/staff update permissions should remain intact'
)
assert.match(
  rules,
  /match \/checks\/\{checkId\} \{[\s\S]*?allow read: if canCloseRegister\(resource\.data\.storeId\) \|\| canViewHistory\(resource\.data\.storeId\);/,
  'checkout/history read permissions should remain intact'
)
assert.match(
  rules,
  /match \/orderCommandFailures\/\{failureId\} \{[\s\S]*?allow create: if validOrderCommandFailure\(\);/,
  'orderCommandFailures should keep validated create for observability'
)

const lockdownPreview = rules
  .replace(
    /function legacyPublicOrderWritesAllowed\(\) \{([\s\S]*?)return true;/,
    'function legacyPublicOrderWritesAllowed() {$1return false;'
  )
  .replace(
    /function legacyPublicTableOccupyAllowed\(\) \{([\s\S]*?)return true;/,
    'function legacyPublicTableOccupyAllowed() {$1return false;'
  )
const lockdownOrdersBlock = extractBlock(lockdownPreview, 'match /orders/{orderId}')
const lockdownOrderItemsBlock = extractBlock(lockdownPreview, 'match /orderItems/{itemId}')

assert.match(lockdownPreview, /function legacyPublicOrderWritesAllowed\(\) \{[\s\S]*?return false;/)
assert.match(lockdownPreview, /function legacyPublicTableOccupyAllowed\(\) \{[\s\S]*?return false;/)
assert.ok(
  !lockdownOrdersBlock.includes('allow create: if true;'),
  'lockdown preview should not leave orders public create as a literal true'
)
assert.ok(
  !lockdownOrderItemsBlock.includes('allow create: if true;'),
  'lockdown preview should not leave orderItems public create as a literal true'
)

for (const token of [
  'Compatibility stage',
  'Mainline stage',
  'Lockdown stage',
  'legacyPublicOrderWritesAllowed',
  'legacyPublicTableOccupyAllowed',
  '本番 deploy は未実行',
]) {
  assertToken(doc08, token, '08-rules-lockdown.md')
}

for (const token of [
  'Rules compatibility deploy',
  'Rules lockdown deploy',
  'legacyPublicOrderWritesAllowed',
  'legacyPublicTableOccupyAllowed',
  'VITE_ORDER_COMMAND_RUNTIME=client',
]) {
  assertToken(doc11, token, '11-integration-release.md')
}

const pkg = JSON.parse(packageJson)
assert.equal(pkg.scripts['check:order-rules-lockdown'], 'node scripts/check-order-rules-lockdown.mjs')
assert.ok(pkg.scripts.check.includes('npm run check:order-rules-lockdown'))

console.log('order rules lockdown checks passed')
