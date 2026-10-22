import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { buildStoreSetupSteps, countDoneSetupSteps, shouldShowStoreSetupGuide } from '../src/lib/storeSetup.js'
import { describeOwnerStoreManager } from '../src/lib/ownerDashboard.js'

// 2026-10-22 店舗登録：店は運営者が店舗名だけで作り、店長は招待リンクで入る。画面からは店も店舗コードも作れない。
const require = createRequire(import.meta.url)
const onboarding = require('../functions/storeOnboarding.js')

const [functionsIndex, rules, storeContext, ownerPage, approvalGate, staffLayout, app, packageJson] = await Promise.all([
  readFile('functions/index.js', 'utf8'),
  readFile('firestore.rules', 'utf8'),
  readFile('src/contexts/StoreContext.jsx', 'utf8'),
  readFile('src/pages/owner/OwnerPage.jsx', 'utf8'),
  readFile('src/components/ApprovalGate.jsx', 'utf8'),
  readFile('src/pages/staff/StaffLayout.jsx', 'utf8'),
  readFile('src/AuthenticatedApp.jsx', 'utf8'),
  readFile('package.json', 'utf8'),
])

// 店舗コード：6文字、紛らわしい文字（0・O・1・I）を使わない。
for (let index = 0; index < 50; index += 1) {
  const code = onboarding.generateStoreCode()
  assert.equal(code.length, onboarding.STORE_CODE_LENGTH)
  assert.match(code, /^[A-HJ-NP-Z2-9]+$/)
}
// 招待の秘密の値はハッシュで照合する。
const hash = onboarding.hashInviteToken('secret-token')
assert.notEqual(hash, 'secret-token')
assert.equal(onboarding.inviteTokenMatches('secret-token', hash), true)
assert.equal(onboarding.inviteTokenMatches('other', hash), false)
assert.equal(onboarding.inviteTokenMatches(undefined, hash), false)
assert.equal(onboarding.INVITE_TTL_MS, 7 * 24 * 60 * 60 * 1000)

for (const name of ['createStoreCommand', 'reissueStoreInviteCommand', 'claimStoreInviteCommand', 'previewStoreInviteCommand']) {
  assert.match(functionsIndex, new RegExp(`exports\\.${name} = createOrderCommandCallable\\(storeOnboarding\\.${name}`))
}
assert.match(rules, /match \/storeCodes\/\{code\} \{[\s\S]*?allow write: if false;/)
assert.match(rules, /match \/stores\/\{storeId\} \{[\s\S]*?allow create: if false;/)
assert.match(rules, /match \/storeInvites\/\{inviteId\} \{\s*allow read, write: if false;/)
assert.match(rules, /request\.resource\.data\.get\('storeCode', null\) == resource\.data\.get\('storeCode', null\)/)
// 画面は店を作らない。店が無い人には案内を出す。
assert.doesNotMatch(storeContext, /setDoc|generateCode/)
assert.match(storeContext, /setStoreMissing\(true\)/)
assert.match(staffLayout, /storeMissing \? <NoStoreScreen \/>/)
assert.match(approvalGate, /return <NoStoreScreen \/>/)
assert.match(app, /path="\/invite\/:inviteId\/:token"/)
assert.doesNotMatch(ownerPage, /OwnerAllowedEmail|addOwnerAllowedEmail/)
assert.match(ownerPage, /createStore\(\{ storeName \}\)/)

// はじめの準備：件数で済んだかを決め、前からある店は欠けているときだけ出す。
const fresh = buildStoreSetupSteps({ storeName: '店舗名未設定', staffCount: 0, productCount: 0, tableCount: 0 })
assert.equal(fresh[0].current, true)
assert.equal(countDoneSetupSteps(fresh), 0)
const ready = buildStoreSetupSteps({ storeName: 'やきとり 一番', staffCount: 2, productCount: 10, tableCount: 5 })
assert.equal(countDoneSetupSteps(ready), 4)
assert.equal(ready.find(step => step.current)?.key, 'qr')
assert.equal(shouldShowStoreSetupGuide({ setupGuideRequired: false, setupGuideClosed: false, steps: ready }), false, 'existing complete stores do not see the guide')
assert.equal(shouldShowStoreSetupGuide({ setupGuideRequired: true, setupGuideClosed: false, steps: ready }), true, 'new stores keep the guide until finished')
assert.equal(shouldShowStoreSetupGuide({ setupGuideRequired: true, setupGuideClosed: true, steps: fresh }), false)
assert.equal(shouldShowStoreSetupGuide({ setupGuideRequired: false, setupGuideClosed: false, steps: fresh }), true)

// 運営者の店舗一覧の店長の状態。
const now = 1_000_000_000
assert.equal(describeOwnerStoreManager({ ownerEmail: 'a@example.com' }, now).state, 'assigned')
assert.equal(describeOwnerStoreManager({ ownerEmail: '', managerInviteExpiresAtMs: now + 6.5 * 86_400_000 }, now).label, '店長：招待中（あと7日）')
assert.equal(describeOwnerStoreManager({ ownerEmail: '', managerInviteExpiresAtMs: now - 1 }, now).state, 'none')
assert.equal(describeOwnerStoreManager({ ownerEmail: '', createdByOperator: false }, now).label, '店長：最初のオーナー（Google）', 'legacy stores keep their original owner')

const pkg = JSON.parse(packageJson)
assert.equal(pkg.scripts['check:store-onboarding'], 'node scripts/check-store-onboarding.mjs')
assert.ok(pkg.scripts.check.includes('check:store-onboarding'))

console.log('store onboarding checks passed')
