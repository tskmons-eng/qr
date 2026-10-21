import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { OWNER_EMAIL, isSuperAdminEmail } from '../src/lib/ownerIdentity.js'

// 2026-10-22 整理 第4章 4-A：サーバーで「誰か」を確かめ、注文データを画面から書き換えさせない。
const [auth, handlers, cancelPasscode, rules, packageJson] = await Promise.all([
  readFile('functions/orderCommandAuth.js', 'utf8'),
  readFile('functions/orderCommandHandlers.js', 'utf8'),
  readFile('functions/cancelPasscode.js', 'utf8'),
  readFile('firestore.rules', 'utf8'),
  readFile('package.json', 'utf8'),
])

// K5：スタッフの操作は、店長・オーナーか、スタッフを選んだ端末だけ。店舗コードだけの端末は staff-not-selected。
assert.match(auth, /async function computeStaffActor\(db, request, storeId\)/)
assert.match(auth, /throw commandError\('staff-not-selected'/)
assert.match(auth, /async function assertStoreAccess\(db, request, storeId\) \{[\s\S]*?return resolveStaffActor\(db, request, storeId\)/)
assert.doesNotMatch(auth, /canAccessStore/, 'store access should always resolve a staff actor')
// 操作した人の名前はサーバーが決める。画面から送られた activeStaff を処理の引数で受け取らない。
assert.doesNotMatch(handlers, /async function \w+\(\{[^}]*\bactiveStaff\b[^}]*\}, request\)/, 'handlers should not trust activeStaff from the client')
assert.doesNotMatch(handlers, /\bactiveStaff,\n\s*\} = data/, 'handlers should not read activeStaff from data')
for (const handler of ['submitStaffOrderItems', 'seatStaffOrderSession', 'completeCheckoutCommand', 'cancelOrderItemCommand', 'moveTableOrderCommand', 'guideReservationToTableCommand']) {
  const body = handlers.slice(handlers.indexOf(`async function ${handler}(`))
  const head = body.slice(0, body.indexOf('runTransaction') > 0 ? body.indexOf('runTransaction') : 2000)
  assert.match(head, /const activeStaff = await (assertStoreAccess|resolveStaffActor)\(db, request, /, `${handler} should resolve the actor on the server`)
}
assert.match(cancelPasscode, /const actor = await resolveStaffActor\(db, request, storeId\)/)

// K8：人数分の自動追加は、お客様の端末の値ではなく店舗設定を読む。
assert.match(handlers, /async function startCustomerOrderSession\(\{ guestCount, storeId, tableId \}\)/)
assert.match(handlers, /const guestAutoAdd = await loadStoreGuestAutoAdd\(db, storeId\)/)

// L6：スーパー管理者のメールは3か所で同じ値。大文字・小文字を区別しない。
assert.match(auth, new RegExp(`const SUPER_EMAIL = '${OWNER_EMAIL.replace('.', '\\.')}'`))
assert.match(rules, new RegExp(`authEmail\\(\\) == '${OWNER_EMAIL.replace('.', '\\.')}'`))
assert.equal(isSuperAdminEmail(' TSK.Mons@Gmail.com '), true)
assert.equal(isSuperAdminEmail('someone@example.com'), false)
assert.match(auth, /\.trim\(\)\.toLowerCase\(\)/)

const pkg = JSON.parse(packageJson)
assert.equal(pkg.scripts['check:staff-actor'], 'node scripts/check-staff-actor.mjs')
assert.ok(pkg.scripts.check.includes('check:staff-actor'), 'full check should include staff actor checks')

console.log('staff actor checks passed')
