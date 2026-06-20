import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  formatAllowedEmailAddedAt,
  normalizeAllowedEmailEntry,
  normalizeOwnerEmail,
  sortAllowedEmailEntries,
  validateOwnerEmail,
} from '../src/lib/ownerAccess.js'
import { isSuperAdminEmail, OWNER_EMAIL } from '../src/lib/ownerIdentity.js'

assert.equal(normalizeOwnerEmail('  USER@Example.COM '), 'user@example.com')
assert.equal(validateOwnerEmail(''), '正しいメールアドレスを入力してください')
assert.equal(validateOwnerEmail('invalid'), '正しいメールアドレスを入力してください')
assert.equal(validateOwnerEmail('user@example.com'), '')
assert.deepEqual(normalizeAllowedEmailEntry('USER@Example.COM', { addedBy: undefined }), {
  id: 'USER@Example.COM',
  email: 'user@example.com',
  addedBy: null,
})

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
assert.equal(OWNER_EMAIL, 'tsk.mons@gmail.com')
assert.equal(isSuperAdminEmail('tsk.mons@gmail.com'), true)
assert.equal(isSuperAdminEmail('manager@example.com'), false)

const firestoreRules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
assert.match(firestoreRules, /match \/allowedEmails\/\{email\}\s*\{[\s\S]*allow write: if isSuper\(\);/)
assert.doesNotMatch(firestoreRules, /match \/allowedEmails\/\{email\}\s*\{[\s\S]*allow write: if isGoogle\(\);/)

const ownerAccessService = readFileSync(new URL('../src/services/ownerAccessService.js', import.meta.url), 'utf8')
assert.match(ownerAccessService, /export function subscribeAllowedEmailEntries/)
assert.match(ownerAccessService, /export async function loadAllowedEmailEntries/)
assert.match(ownerAccessService, /export function saveAllowedEmail/)
assert.match(ownerAccessService, /email: normalizeOwnerEmail\(email\)/)
assert.match(ownerAccessService, /addedBy: addedBy \?\? null/)

console.log('owner access checks passed')
