import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  calculateIncludedTax,
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

assert.deepEqual(normalizeGuestAutoAdd({ enabled: true, productId: 'p1' }), {
  ...GUEST_AUTO_ADD_DEFAULTS,
  enabled: true,
  productId: 'p1',
})

assert.equal(normalizeAllowedEmail('  USER@Example.COM  '), 'user@example.com')
assert.equal(validateAllowedEmail('invalid', []), '正しいメールアドレスを入力してください')
assert.equal(validateAllowedEmail('user@example.com', ['user@example.com']), 'すでに追加されています')
assert.equal(validateAllowedEmail('user@example.com', []), '')

assert.equal(calculateIncludedTax(1000, 10), 91)
assert.equal(calculateIncludedTax(1000, 8), 74)
assert.equal(calculateIncludedTax(1000, 0), 0)

const settingsPage = readFileSync(new URL('../src/pages/admin/SettingsPage.jsx', import.meta.url), 'utf8')
const deviceSoundSettings = readFileSync(new URL('../src/components/admin/DeviceSoundSettings.jsx', import.meta.url), 'utf8')

assert.match(settingsPage, /DeviceSoundSettings/)
assert.match(deviceSoundSettings, /saveSoundPrefs/)
assert.match(deviceSoundSettings, /saveKitchenSoundPrefs/)
assert.match(deviceSoundSettings, /ホールとキッチンで使う通知音/)

console.log('settings config checks passed')
