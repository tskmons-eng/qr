import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  calculateIncludedTax,
  CUSTOMER_SETTING_TOGGLES,
  GUEST_AUTO_ADD_DEFAULTS,
  normalizeAllowedEmail,
  normalizeGuestAutoAdd,
  normalizeStoreConfig,
  STORE_CONFIG_DEFAULTS,
  validateAllowedEmail,
} from '../src/lib/settingsConfig.js'

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

assert.equal(normalizeAllowedEmail('  USER@Example.COM  '), 'user@example.com')
assert.equal(validateAllowedEmail('invalid', []), '正しいメールアドレスを入力してください')
assert.equal(validateAllowedEmail('user@example.com', ['user@example.com']), 'すでに追加されています')
assert.equal(validateAllowedEmail('user@example.com', []), '')

assert.equal(calculateIncludedTax(1000, 10), 91)
assert.equal(calculateIncludedTax(1000, 8), 74)
assert.equal(calculateIncludedTax(1000, 0), 0)

const settingsPage = readFileSync(new URL('../src/pages/admin/SettingsPage.jsx', import.meta.url), 'utf8')
const settingsService = readFileSync(new URL('../src/services/settingsService.js', import.meta.url), 'utf8')
const storeWorkflowSettings = readFileSync(new URL('../src/components/admin/StoreWorkflowSettings.jsx', import.meta.url), 'utf8')
const deviceSoundSettings = readFileSync(new URL('../src/components/admin/DeviceSoundSettings.jsx', import.meta.url), 'utf8')
const staffLayout = readFileSync(new URL('../src/pages/staff/StaffLayout.jsx', import.meta.url), 'utf8')
const staffAuthStyles = readFileSync(new URL('../src/styles/staff-auth.css', import.meta.url), 'utf8')

assert.match(settingsPage, /DeviceSoundSettings/)
assert.match(settingsPage, /notificationControls/)
assert.match(settingsPage, /CUSTOMER_SETTING_TOGGLES/)
assert.match(settingsPage, /subscribeAllowedEmails\(setAllowedEmails\)/)
assert.match(settingsPage, /addAllowedEmail\(email, user\?\.email \?\? null\)/)
assert.doesNotMatch(settingsPage, /loadAllowedEmails/)
assert.doesNotMatch(settingsPage, /setAllowedEmails\(prev =>/)
assert.match(settingsService, /subscribeAllowedEmailEntries/)
assert.match(settingsService, /loadAllowedEmailEntries/)
assert.match(settingsService, /saveAllowedEmail/)
assert.match(settingsService, /deleteAllowedEmail/)
assert.doesNotMatch(settingsService, /setDoc\(doc\(db, 'allowedEmails'/)
assert.match(storeWorkflowSettings, /人数設定画面に追加内容のボタン表示を出す/)
assert.match(storeWorkflowSettings, /checked=\{guestAutoAdd\.showGuestCountButton !== false\}/)
assert.match(storeWorkflowSettings, /onGuestAutoAddChange\(\{ showGuestCountButton: event\.target\.checked \}\)/)
assert.match(staffLayout, /notificationControls=\{notificationControls\}/)
assert.match(staffLayout, /onConfigSaved=\{setStoreConfig\}/)
assert.match(deviceSoundSettings, /saveSoundPrefs/)
assert.match(deviceSoundSettings, /saveKitchenSoundPrefs/)
assert.match(deviceSoundSettings, /ホールとキッチンで使う通知音/)
assert.match(deviceSoundSettings, /この端末の通知/)
assert.match(readFileSync(new URL('../src/lib/settingsConfig.js', import.meta.url), 'utf8'), /商品行タップで追加/)
assert.doesNotMatch(staffAuthStyles, /sound-settings/)

console.log('settings config checks passed')
