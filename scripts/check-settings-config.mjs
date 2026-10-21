import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  calculateIncludedTax,
  CUSTOMER_SETTING_TOGGLES,
  GUEST_AUTO_ADD_DEFAULTS,
  normalizeGuestAutoAdd,
  normalizeStoreConfig,
  STORE_CONFIG_DEFAULTS,
} from '../src/lib/settingsConfig.js'
import {
  STORE_NAME_FALLBACK,
  STORE_NAME_MAX_LENGTH,
  normalizeStoreName,
  validateStoreName,
} from '../src/lib/storeIdentity.js'

assert.deepEqual(normalizeStoreConfig({ showItemPrice: false, taxRate: 8 }), {
  ...STORE_CONFIG_DEFAULTS,
  showItemPrice: false,
  taxRate: 8,
  guestAutoAdd: GUEST_AUTO_ADD_DEFAULTS,
})
assert.equal(STORE_CONFIG_DEFAULTS.customerMenuTapToAddEnabled, true)
assert.equal(
  CUSTOMER_SETTING_TOGGLES.some(setting => setting.key === 'customerMenuTapToAddEnabled'),
  true,
)

assert.deepEqual(normalizeGuestAutoAdd({ enabled: true, productId: 'p1' }), {
  ...GUEST_AUTO_ADD_DEFAULTS,
  enabled: true,
  productId: 'p1',
})
assert.deepEqual(normalizeGuestAutoAdd({ showGuestCountButton: false }), {
  ...GUEST_AUTO_ADD_DEFAULTS,
  showGuestCountButton: false,
})

assert.equal(normalizeStoreName('  テスト 店  '), 'テスト 店')
assert.equal(normalizeStoreName('   '), STORE_NAME_FALLBACK)
assert.equal(validateStoreName('あ'.repeat(STORE_NAME_MAX_LENGTH + 1)), `店舗名は${STORE_NAME_MAX_LENGTH}文字以内で入力してください`)
assert.equal(validateStoreName('テスト店'), '')

assert.equal(calculateIncludedTax(1000, 10), 91)
assert.equal(calculateIncludedTax(1000, 8), 74)
assert.equal(calculateIncludedTax(1000, 0), 0)

const settingsPage = readFileSync(new URL('../src/pages/admin/SettingsPage.jsx', import.meta.url), 'utf8')
const settingsService = readFileSync(new URL('../src/services/settingsService.js', import.meta.url), 'utf8')
const storeCodeCard = readFileSync(new URL('../src/components/admin/StoreCodeCard.jsx', import.meta.url), 'utf8')
const readSource = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const customerOrderSettings = readSource('src/components/admin/CustomerOrderSettings.jsx')
const storeOperationSettings = readSource('src/components/admin/StoreOperationSettings.jsx')
const settingsGroup = readSource('src/components/admin/SettingsGroup.jsx')
const configEditor = readSource('src/hooks/useStoreConfigEditor.js')
const storeConfigHook = readSource('src/hooks/useStoreConfig.js')
const deviceSoundSettings = readFileSync(new URL('../src/components/admin/DeviceSoundSettings.jsx', import.meta.url), 'utf8')
const staffLayout = readFileSync(new URL('../src/pages/staff/StaffLayout.jsx', import.meta.url), 'utf8')
const staffAuthStyles = readFileSync(new URL('../src/styles/staff-auth.css', import.meta.url), 'utf8')

assert.match(settingsPage, /DeviceSoundSettings/)
assert.match(settingsPage, /notificationControls/)
assert.match(customerOrderSettings, /CUSTOMER_SETTING_TOGGLES/)
assert.match(settingsPage, /loadStoreIdentity/)
assert.match(settingsPage, /saveStoreName/)
assert.match(settingsPage, /storeNameChanged/)
// 許可メールはオーナー画面の「許可メール」タブだけで管理する（2026-10-21 整理 第1章）。
assert.doesNotMatch(settingsPage, /AllowedEmail|allowedEmails/)
assert.doesNotMatch(settingsService, /allowedEmails|AllowedEmail/)
assert.match(settingsService, /export async function loadStoreIdentity/)
assert.match(settingsService, /export async function saveStoreName/)
assert.match(settingsService, /updateDoc\(doc\(db, 'stores', storeId\)/)
assert.doesNotMatch(settingsService, /setDoc\(doc\(db, 'allowedEmails'/)
assert.match(storeCodeCard, /店舗情報/)
assert.match(storeCodeCard, /店舗名[\s\S]*店舗コード/)
assert.match(storeCodeCard, /maxLength=\{STORE_NAME_MAX_LENGTH\}/)
assert.match(customerOrderSettings, /人数を決める画面に、追加される内容を表示する/)
assert.match(customerOrderSettings, /checked=\{guestAutoAdd\.showGuestCountButton !== false\}/)
assert.match(staffLayout, /notificationControls=\{notificationControls\}/)

// 2026-10-21 整理 第2章：店舗情報／お客様の注文／お店の運用／この端末だけの設定に分け、押したらすぐ保存する。
assert.match(settingsPage, /<CustomerOrderSettings [^>]*onSave=\{save\}/)
assert.match(settingsPage, /<StoreOperationSettings [^>]*onSave=\{save\}/)
assert.doesNotMatch(settingsPage, /SettingsSaveButton|saveStoreConfig\(|onConfigSaved/)
assert.match(storeCodeCard, /<SettingsGroup title="店舗情報">/)
assert.match(customerOrderSettings, /<SettingsGroup title="お客様の注文"/)
assert.match(storeOperationSettings, /<SettingsGroup title="お店の運用"/)
assert.match(storeOperationSettings, /<CancelPasscodeSettings storeId=\{storeId\} \/>/)
assert.match(deviceSoundSettings, /title="この端末だけの設定"\s+scope="device"/)
// 提供済み表示は、提供済み管理が OFF のとき押せない。
assert.match(customerOrderSettings, /setting\.key === 'showServedStatus' && !servedWorkflowEnabled/)
// 保存は変えた項目だけ。失敗したら元に戻して知らせる。
assert.match(settingsService, /export function saveStoreConfigPatch/)
assert.match(settingsService, /\{ merge: true \}/)
assert.match(configEditor, /setStatus\(statusKey, 'error'\)/)
assert.match(configEditor, /if \(next\[key\] === patch\[key\]\) delete next\[key\]/)
assert.match(settingsGroup, /保存できませんでした/)
// 開いたままのスタッフ画面・厨房にもすぐ反映する（変更通知）。
assert.match(settingsService, /export function subscribeStoreConfig/)
assert.match(storeConfigHook, /subscribeStoreConfig\(/)
for (const path of ['src/pages/staff/StaffLayout.jsx', 'src/pages/kitchen/KitchenPage.jsx', 'src/pages/staff/TableDetailPage.jsx', 'src/pages/staff/RemainingPage.jsx']) {
  const source = readSource(path)
  assert.match(source, /useStoreConfig\(/, `${path} should follow store config changes`)
  assert.doesNotMatch(source, /loadStoreConfig\(/, `${path} should not read store config only once`)
}
assert.match(deviceSoundSettings, /saveSoundPrefs/)
// キッチン通知音はキッチン画面の音の設定だけで変える（2026-10-21 整理 第1章）。
assert.doesNotMatch(deviceSoundSettings, /KitchenSoundPrefs/)
assert.match(deviceSoundSettings, /キッチンの通知音はキッチン画面の音の設定で変えます/)
assert.match(deviceSoundSettings, /この端末の通知/)
assert.match(readFileSync(new URL('../src/lib/settingsConfig.js', import.meta.url), 'utf8'), /商品行タップで追加/)
assert.doesNotMatch(staffAuthStyles, /sound-settings/)

// 税率の既定値は settingsConfig.js の1か所だけ。設定画面と会計で同じ値を使う。
assert.equal(STORE_CONFIG_DEFAULTS.taxRate, 10)
assert.equal(normalizeStoreConfig({}).taxRate, 10)
assert.equal(normalizeStoreConfig({ taxRate: 0 }).taxRate, 0)
assert.equal(normalizeStoreConfig({ taxRate: '8' }).taxRate, 8)
assert.equal(normalizeStoreConfig({ taxRate: null }).taxRate, 10)
assert.equal(normalizeStoreConfig({ taxRate: 'abc' }).taxRate, 10)
assert.equal(normalizeStoreConfig({ taxRate: 150 }).taxRate, 10)
const checkoutService = readFileSync(new URL('../src/services/checkoutService.js', import.meta.url), 'utf8')
assert.match(checkoutService, /normalizeStoreConfig\(/, 'checkout should read taxRate through normalizeStoreConfig')
assert.doesNotMatch(checkoutService, /taxRate\s*\?\?/, 'checkout should not define its own taxRate default')
assert.doesNotMatch(settingsPage, /taxRate\s*\?\?/, 'settings page should not define its own taxRate default')

// 手元のテスト環境（エミュレーター）への切り替えは、本番ビルドでは必ず無効。
const localEmulator = readSource('src/lib/localEmulator.js')
assert.match(localEmulator, /USE_LOCAL_EMULATORS = !import\.meta\.env\.PROD && import\.meta\.env\.VITE_USE_FIREBASE_EMULATORS === 'true'/)
assert.match(localEmulator, /LOCAL_EMULATOR_PROJECT_ID = 'demo-/)
assert.doesNotMatch(readSource('src/components/admin/CancelPasscodeSettings.jsx'), /設定を保存/)

console.log('settings config checks passed')
