import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import {
  LEGACY_STAFF_PERMISSIONS,
  STAFF_PERMISSION_PRESETS,
  normalizeStaffMemberPermissions,
} from '../src/lib/staffPermissions.js'

const require = createRequire(import.meta.url)
const cancelPasscode = require('../functions/cancelPasscode.js')

const [
  rules,
  handlers,
  functionsIndex,
  apiSource,
  staffTableService,
  kitchenService,
  kitchenPage,
  tableDetailPage,
  cancelModal,
  settingsPage,
  errors,
  packageJson,
] = await Promise.all([
  readFile('firestore.rules', 'utf8'),
  readFile('functions/orderCommandHandlers.js', 'utf8'),
  readFile('functions/index.js', 'utf8'),
  readFile('functions/orderCommandApi.js', 'utf8'),
  readFile('src/services/staffTableService.js', 'utf8'),
  readFile('src/services/kitchenService.js', 'utf8'),
  readFile('src/pages/kitchen/KitchenPage.jsx', 'utf8'),
  readFile('src/pages/staff/TableDetailPage.jsx', 'utf8'),
  readFile('src/components/staff/TableCancelModal.jsx', 'utf8'),
  readFile('src/pages/admin/SettingsPage.jsx', 'utf8'),
  readFile('src/lib/orderCommandErrors.js', 'utf8'),
  readFile('package.json', 'utf8'),
])

// サーバーの権限判定は画面（staffPermissions.js）と同じ結果になること。
const memberShapes = [
  {},
  { permissionPreset: 'legacy' },
  { permissionPreset: 'custom', permissions: { manageMenu: true } },
  { permissionPreset: 'unknown-preset' },
  ...STAFF_PERMISSION_PRESETS.map(preset => ({ permissionPreset: preset.key })),
  ...STAFF_PERMISSION_PRESETS.map(preset => ({ permissionPreset: preset.key, permissions: { manageMenu: false, manageSettings: false } })),
  ...STAFF_PERMISSION_PRESETS.map(preset => ({ permissionPreset: preset.key, permissions: { manageMenu: true, manageSettings: true } })),
]
for (const member of memberShapes) {
  const clientPermissions = normalizeStaffMemberPermissions(member, { ...LEGACY_STAFF_PERMISSIONS })
  for (const key of ['manageMenu', 'manageSettings']) {
    assert.equal(
      cancelPasscode.staffMemberHasPermission(member, key),
      clientPermissions[key] === true,
      `server ${key} should match client for ${JSON.stringify(member)}`,
    )
  }
}
assert.equal(cancelPasscode.staffMemberHasPermission(null, 'manageMenu'), false)

// パスコードはハッシュで照合し、形式外・空・違う値は通さない。
const salt = 'check-salt'
const secret = { cancelPasscodeHash: cancelPasscode.hashCancelPasscode('2580', salt), cancelPasscodeSalt: salt }
assert.equal(cancelPasscode.cancelPasscodeMatches('2580', secret), true)
assert.equal(cancelPasscode.cancelPasscodeMatches('2581', secret), false)
assert.equal(cancelPasscode.cancelPasscodeMatches('', secret), false)
assert.equal(cancelPasscode.cancelPasscodeMatches(undefined, secret), false)
assert.equal(cancelPasscode.cancelPasscodeMatches('2580', {}), false)
assert.notEqual(secret.cancelPasscodeHash, '2580')
assert.equal(cancelPasscode.CANCEL_PASSCODE_PATTERN.test('123'), false)
assert.equal(cancelPasscode.CANCEL_PASSCODE_PATTERN.test('123456789'), false)
assert.equal(cancelPasscode.CANCEL_PASSCODE_PATTERN.test('12a4'), false)

// 取消はトランザクションの前にサーバーで確認する。新しい呼び出し口とエラーコードがある。
assert.match(handlers, /assertCancelAllowed\(db, request, itemPreview\.storeId, passcode\)/)
assert.match(functionsIndex, /exports\.setCancelPasscodeCommand = createOrderCommandCallable\(cancelPasscode\.setCancelPasscodeCommand/)
for (const code of ['invalid-cancel-passcode', 'invalid-cancel-passcode-format', 'cancel-passcode-not-set']) {
  assert.match(apiSource, new RegExp(`'${code}'`), `functions should map ${code}`)
  assert.match(errors, new RegExp(`'${code}'`), `client should explain ${code}`)
}

// パスコードは画面から読めない。設定状況はサーバーだけが書く。
assert.match(rules, /match \/storeSecrets\/\{storeId\} \{\s*allow read, write: if false;/)
assert.match(rules, /request\.resource\.data\.get\('cancelPasscodeStatus', null\) == resource\.data\.get\('cancelPasscodeStatus', null\)/)

// 画面側で古い照合（stores.adminPasscode）や標準ダイアログに戻さない。席詳細と厨房は同じ取消モーダルを使う。
assert.doesNotMatch(staffTableService, /adminPasscode/)
assert.match(staffTableService, /cancelOrderItemWithPasscode\(/)
assert.match(kitchenService, /cancelOrderItemWithPasscode\(/)
assert.doesNotMatch(kitchenPage, /\bconfirm\(/)
for (const page of [kitchenPage, tableDetailPage]) {
  assert.match(page, /useOrderItemCancel\(/)
  assert.match(page, /<TableCancelModal \{\.\.\.itemCancel\.modalProps\} \/>/)
}
assert.match(cancelModal, /取消パスコード/)
assert.match(cancelModal, /disabled=\{cancelling \|\| blocked\}/)
assert.match(settingsPage, /<CancelPasscodeSettings storeId=\{storeId\} \/>/)

// 総当たり対策と、打ち間違いを失敗ログに混ぜないこと。
assert.equal(cancelPasscode.MAX_FAILED_ATTEMPTS, 5)
for (const code of ['invalid-cancel-passcode', 'invalid-cancel-passcode-format', 'cancel-passcode-locked']) {
  assert.ok(cancelPasscode.EXPECTED_PASSCODE_ERROR_CODES.has(code), `functions should not log ${code} as a failure`)
  assert.match(errors, new RegExp(`'${code}'`), `client should know ${code}`)
}
assert.match(apiSource, /if \(!EXPECTED_PASSCODE_ERROR_CODES\.has\(error\?\.code\)\)/)
const [failureService, cancelHook] = await Promise.all([
  readFile('src/services/orderCommandFailureService.js', 'utf8'),
  readFile('src/hooks/useOrderItemCancel.js', 'utf8'),
])
assert.match(failureService, /if \(!isExpectedOperatorError\(error\)\)/)
// 開きっぱなしの厨房タブレットでも、開くたびに最新の設定状況を読む。読み込み前は「未設定」で止めない。
assert.match(cancelHook, /function open\([^)]*\) \{[\s\S]*?reload\(\)/)
assert.match(cancelHook, /passcodeRequired && loaded && !status\.isSet/)
assert.match(cancelHook, /!user\.isAnonymous/)

const pkg = JSON.parse(packageJson)
assert.equal(pkg.scripts['check:cancel-passcode'], 'node scripts/check-cancel-passcode.mjs')
assert.ok(pkg.scripts.check.includes('check:cancel-passcode'), 'full check should include cancel passcode checks')

console.log('cancel passcode checks passed')
