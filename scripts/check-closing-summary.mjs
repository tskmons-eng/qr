import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { calculateCashCount, paymentMethodKey, summarizeChecksForClosing } from '../src/lib/closingSummary.js'

// 締めの数え方（2026-10-30 締め 第1章）。画面とサーバーで同じ答えになること。
const require = createRequire(import.meta.url)
const server = require('../functions/closingSummary.js')

const checks = [
  { status: 'completed', total: 7480, guestCount: 4, taxAmount: 680, paymentMethod: 'cash', discountAmount: 0 },
  { status: 'completed', total: 6732, guestCount: 4, taxAmount: 612, paymentMethod: 'qr', discountAmount: 748 },
  { status: 'completed', total: 18420, guestCount: 6, taxAmount: 1675, paymentMethod: 'card' },
  { status: 'completed', total: 1980, guestCount: 1, taxAmount: 180 },
  { status: 'completed', total: 1000, guestCount: 2, paymentMethod: '現金' },
  { status: 'completed', total: 500, guestCount: 1, paymentMethod: 'paypay-old' },
  { status: 'voided', total: 3180, guestCount: 2, paymentMethod: 'cash' },
  { status: 'open', total: 9999 },
  null,
]

const summary = summarizeChecksForClosing(checks)
assert.equal(summary.salesTotal, 7480 + 6732 + 18420 + 1980 + 1000 + 500)
assert.equal(summary.checkCount, 6)
assert.equal(summary.customerCount, 18)
assert.equal(summary.averageSpend, Math.round(36112 / 6))
assert.equal(summary.taxTotal, 680 + 612 + 1675 + 180)
assert.equal(summary.discountTotal, 748)
assert.equal(summary.discountCount, 1)
assert.equal(summary.voidedCount, 1)
assert.equal(summary.voidedTotal, 3180)
assert.deepEqual(summary.byPaymentMethod.cash, { count: 3, total: 7480 + 1980 + 1000 })
assert.deepEqual(summary.byPaymentMethod.card, { count: 1, total: 18420 })
assert.deepEqual(summary.byPaymentMethod.qr, { count: 1, total: 6732 })
assert.deepEqual(summary.byPaymentMethod.other, { count: 1, total: 500 })
assert.equal(summary.cashSales, 10460)
assert.deepEqual(server.summarizeChecksForClosing(checks), summary, 'server closing summary should match the screen')
assert.deepEqual(summarizeChecksForClosing([]), server.summarizeChecksForClosing([]))
assert.equal(summarizeChecksForClosing([]).averageSpend, 0)

for (const method of [undefined, null, '', 'cash', '現金', 'card', 'qr', 'other-x']) {
  assert.equal(paymentMethodKey(method), server.paymentMethodKey(method), `payment key ${method}`)
}

const cashCases = [
  { cashSales: 10460, openingCash: 30000, countedCash: 40460 },
  { cashSales: 10460, openingCash: 30000, countedCash: 39960 },
  { cashSales: 10460, openingCash: 30000, countedCash: '' },
  { cashSales: 10460, openingCash: '', countedCash: null },
  { cashSales: 0, openingCash: -5, countedCash: 0 },
]
for (const input of cashCases) {
  assert.deepEqual(calculateCashCount(input), server.calculateCashCount(input), `cash count ${JSON.stringify(input)}`)
}
assert.deepEqual(calculateCashCount(cashCases[0]), { openingCash: 30000, expectedCash: 40460, countedCash: 40460, cashDifference: 0 })
assert.equal(calculateCashCount(cashCases[1]).cashDifference, -500)
assert.equal(calculateCashCount(cashCases[2]).cashDifference, null)

// 取り消し・打ち直し・締めは Functions だけで、レジ締めの権限を確かめる。
const correction = await readFile('functions/checkCorrection.js', 'utf8')
const functionsIndex = await readFile('functions/index.js', 'utf8')
for (const name of ['voidCheckCommand', 'correctCheckCommand', 'closeRegisterCommand']) {
  assert.ok(functionsIndex.includes(`exports.${name} = createOrderCommandCallable(checkCorrection.${name}`), `${name} should be exported`)
}
assert.ok(correction.includes("actorHasPermission(actor, 'closeRegister')"), 'check correction should require closeRegister permission')
assert.ok(correction.includes('assertRegisterOpen(transaction, db, storeId, checkBusinessDate(check))'), 'closed business dates should be locked')
assert.ok(correction.includes('const closingSnap = await transaction.get(closingRef)'), 'one closing per business date, read in the same transaction as the checks')
assert.ok(correction.includes("transaction.get(db.collection('checks').where('storeId', '==', storeId))"), 'closing should count checks inside the transaction')
assert.ok(correction.includes('existing.clientRequestId === clientRequestId'), 'same closing request retried should return the saved closing')

console.log('closing summary checks passed')
