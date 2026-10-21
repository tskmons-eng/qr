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
  // marker 自身の {orderId} ではなく、その後ろのブロックの { から数える。
  const open = source.indexOf('{', start + marker.length)
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

// 2026-10-21 整理 第1章：常に false の切り替え関数をやめ、作成不可を直接書く。動きは同じ。
assert.doesNotMatch(rules, /legacyPublic/, 'retired legacy public write switches should stay removed')
assert.equal(
  countToken(rules, 'allow create: if false;'),
  2,
  'orders and orderItems create should both stay closed to clients'
)

assert.match(
  rules,
  /match \/orders\/\{orderId\} \{[\s\S]*?allow read: if true;[\s\S]*?allow create: if false;[\s\S]*?allow update: if canAccess\(resource\.data\.storeId\);/,
  'orders read/staff update permissions should remain intact'
)
assert.match(
  rules,
  /match \/orderItems\/\{itemId\} \{[\s\S]*?allow read: if true;[\s\S]*?allow create: if false;[\s\S]*?allow update: if canAccess\(resource\.data\.storeId\);/,
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
const lockdownOrdersBlock = extractBlock(lockdownPreview, 'match /orders/{orderId}')
const lockdownOrderItemsBlock = extractBlock(lockdownPreview, 'match /orderItems/{itemId}')

assert.ok(lockdownOrdersBlock.includes('allow create: if false;'), 'orders create should stay closed')
assert.ok(lockdownOrderItemsBlock.includes('allow create: if false;'), 'orderItems create should stay closed')
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
  'Lockdown stage',
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
