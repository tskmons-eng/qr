import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

// 2026-10-22 整理 第4章 4-B：スタッフの4桁パスはサーバーで照合し、画面には置かない。
const require = createRequire(import.meta.url)
const passcodeLock = require('../functions/passcodeLock.js')
const staffPasscode = require('../functions/staffPasscode.js')

const [functionsIndex, auth, rules, staffAuthService, loginScreen, staffLayout, packageJson] = await Promise.all([
  readFile('functions/index.js', 'utf8'),
  readFile('functions/orderCommandAuth.js', 'utf8'),
  readFile('firestore.rules', 'utf8'),
  readFile('src/services/staffAuthService.js', 'utf8'),
  readFile('src/components/staff/StaffLoginScreen.jsx', 'utf8'),
  readFile('src/pages/staff/StaffLayout.jsx', 'utf8'),
  readFile('package.json', 'utf8'),
])

// ロック：5回続けて間違えたら10分。合えば数え直し。ロック中は合っていても通さない。
const nowMs = 1_000_000
let secret = { failedAttempts: 0, lockedUntilMs: 0 }
for (let attempt = 1; attempt < passcodeLock.MAX_FAILED_ATTEMPTS; attempt += 1) {
  const result = passcodeLock.evaluatePasscodeAttempt(secret, false, nowMs)
  assert.equal(result.failure, 'invalid')
  secret = { ...secret, ...result.updates }
}
const locked = passcodeLock.evaluatePasscodeAttempt(secret, false, nowMs)
assert.equal(locked.failure, 'locked')
assert.equal(locked.updates.lockedUntilMs, nowMs + 10 * 60 * 1000)
secret = { ...secret, ...locked.updates }
assert.equal(passcodeLock.evaluatePasscodeAttempt(secret, true, nowMs + 1000).failure, 'locked')
assert.deepEqual(passcodeLock.evaluatePasscodeAttempt(secret, true, nowMs + 10 * 60 * 1000 + 1), {
  failure: null,
  updates: { failedAttempts: 0, lockedUntilMs: 0 },
})
assert.deepEqual(passcodeLock.evaluatePasscodeAttempt({}, true, nowMs), { failure: null, updates: null })

// ハッシュで照合し、4桁以外は通さない。
const { hash, salt } = passcodeLock.createPasscodeHash('2468')
assert.notEqual(hash, '2468')
assert.equal(passcodeLock.passcodeMatches('2468', hash, salt, staffPasscode.STAFF_CODE_PATTERN), true)
assert.equal(passcodeLock.passcodeMatches('2469', hash, salt, staffPasscode.STAFF_CODE_PATTERN), false)
assert.equal(passcodeLock.passcodeMatches('24680', hash, salt, staffPasscode.STAFF_CODE_PATTERN), false)
assert.equal(passcodeLock.passcodeMatches('2468', '', salt, staffPasscode.STAFF_CODE_PATTERN), false)

// 呼び出し口・照合済みの印・rules・画面がそろっていること。
for (const name of ['activateStaffSessionCommand', 'createStaffMemberCommand', 'setStaffCodeCommand']) {
  assert.match(functionsIndex, new RegExp(`exports\\.${name} = createOrderCommandCallable\\(staffPasscode\\.${name}`))
}
assert.match(auth, /session\.verifiedStaffMemberId !== session\.staffMemberId/)
// 今のパスなしで決め直せるのは店長・オーナー（Google ログイン）だけ。
const staffPasscodeSource = await readFile('functions/staffPasscode.js', 'utf8')
assert.match(staffPasscodeSource, /const requiresCurrentCode = !actor\.isStoreManager/)
assert.match(staffPasscodeSource, /if \(hasCode && requiresCurrentCode\) \{/)
assert.match(rules, /match \/staffSecrets\/\{memberId\} \{\s*allow read, write: if false;/)
assert.doesNotMatch(staffAuthService, /setDoc\(doc\(db, 'staffSessions'/, 'the client should not write the selected staff member')
assert.match(staffAuthService, /callOrderCommandFunction\('activateStaffSessionCommand'/)
assert.doesNotMatch(loginScreen, /selected\.code|member\.code/)
assert.match(staffLayout, /activateStaffMemberSession\(\{ storeId, staff, code \}\)/)

const pkg = JSON.parse(packageJson)
assert.equal(pkg.scripts['check:staff-passcode'], 'node scripts/check-staff-passcode.mjs')
assert.ok(pkg.scripts.check.includes('check:staff-passcode'), 'full check should include staff passcode checks')

console.log('staff passcode checks passed')
