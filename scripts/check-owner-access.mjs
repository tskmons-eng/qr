import assert from 'node:assert/strict'
import {
  formatAllowedEmailAddedAt,
  normalizeOwnerEmail,
  sortAllowedEmailEntries,
  validateOwnerEmail,
} from '../src/lib/ownerAccess.js'

assert.equal(normalizeOwnerEmail('  USER@Example.COM '), 'user@example.com')
assert.equal(validateOwnerEmail(''), '正しいメールアドレスを入力してください')
assert.equal(validateOwnerEmail('invalid'), '正しいメールアドレスを入力してください')
assert.equal(validateOwnerEmail('user@example.com'), '')

const entries = [
  { email: 'new@example.com', addedAt: { seconds: 20 } },
  { email: 'old@example.com', addedAt: { seconds: 10 } },
  { email: 'missing@example.com' },
]
assert.deepEqual(sortAllowedEmailEntries(entries).map(entry => entry.email), [
  'missing@example.com',
  'old@example.com',
  'new@example.com',
])

assert.equal(formatAllowedEmailAddedAt({
  addedAt: { toDate: () => new Date(2026, 4, 9, 13, 5, 0) },
}).includes('2026'), true)
assert.equal(formatAllowedEmailAddedAt({}), '')

console.log('owner access checks passed')
