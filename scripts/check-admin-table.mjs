import assert from 'node:assert/strict'
import { buildTableOrderUrl, generateTableQrToken, normalizeTableName, TABLE_STATUS_LABELS } from '../src/lib/adminTable.js'

assert.equal(normalizeTableName('  A1  '), 'A1')
assert.equal(buildTableOrderUrl('https://example.com', 'abc'), 'https://example.com/order/abc')
assert.equal(TABLE_STATUS_LABELS.vacant, '空席')
assert.equal(TABLE_STATUS_LABELS.checkout_pending, '会計待ち')

const token = generateTableQrToken(bytes => {
  bytes.forEach((_, index) => {
    bytes[index] = index
  })
})

assert.equal(token, '000102030405060708090a0b0c0d0e0f')
assert.equal(token.length, 32)

console.log('admin table checks passed')
