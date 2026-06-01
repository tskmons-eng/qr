import assert from 'node:assert/strict'
import {
  calculateIncludedTax,
  normalizeAllowedEmail,
  normalizeStoreConfig,
  STORE_CONFIG_DEFAULTS,
  validateAllowedEmail,
} from '../src/lib/settingsConfig.js'

assert.deepEqual(normalizeStoreConfig({ showItemPrice: false, taxRate: 8 }), {
  ...STORE_CONFIG_DEFAULTS,
  showItemPrice: false,
  taxRate: 8,
})

assert.equal(normalizeAllowedEmail('  USER@Example.COM  '), 'user@example.com')
assert.equal(validateAllowedEmail('invalid', []), '正しいメールアドレスを入力してください')
assert.equal(validateAllowedEmail('user@example.com', ['user@example.com']), 'すでに追加されています')
assert.equal(validateAllowedEmail('user@example.com', []), '')

assert.equal(calculateIncludedTax(1000, 10), 91)
assert.equal(calculateIncludedTax(1000, 8), 74)
assert.equal(calculateIncludedTax(1000, 0), 0)

console.log('settings config checks passed')
