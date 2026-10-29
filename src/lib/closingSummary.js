import { PAYMENT_METHOD_OPTIONS } from './paymentMethods.js'

// 締めの数字を会計の記録から数える（2026-10-30 締め 第1章）。
// サーバー（functions/closingSummary.js）と同じ数え方。同じ答えになることは scripts/check-closing-summary.mjs で確かめている。
// 画面はこれで「いまの数字」を見せ、締めの記録はサーバーが数え直したものを残す。
const PAYMENT_METHOD_KEYS = PAYMENT_METHOD_OPTIONS.map(option => option.value)

function money(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.round(amount) : 0
}

export function paymentMethodKey(method) {
  if (!method || method === '現金') return 'cash'
  return PAYMENT_METHOD_KEYS.includes(method) ? method : 'other'
}

// 取り消し（打ち直し前を含む）は売上に入れず、件数と金額だけを別に数える。
export function summarizeChecksForClosing(checks) {
  const byPaymentMethod = Object.fromEntries([...PAYMENT_METHOD_KEYS, 'other'].map(key => [key, { count: 0, total: 0 }]))
  const summary = {
    salesTotal: 0,
    checkCount: 0,
    customerCount: 0,
    averageSpend: 0,
    taxTotal: 0,
    discountTotal: 0,
    discountCount: 0,
    voidedCount: 0,
    voidedTotal: 0,
    cashSales: 0,
    byPaymentMethod,
  }
  for (const check of checks ?? []) {
    const total = money(check?.total)
    if (check?.status === 'voided') {
      summary.voidedCount += 1
      summary.voidedTotal += total
      continue
    }
    if (check?.status !== 'completed') continue
    summary.checkCount += 1
    summary.salesTotal += total
    summary.customerCount += money(check.guestCount)
    summary.taxTotal += money(check.taxAmount)
    const discount = money(check.discountAmount)
    if (discount > 0) {
      summary.discountTotal += discount
      summary.discountCount += 1
    }
    const method = byPaymentMethod[paymentMethodKey(check.paymentMethod)]
    method.count += 1
    method.total += total
  }
  summary.averageSpend = summary.checkCount > 0 ? Math.round(summary.salesTotal / summary.checkCount) : 0
  summary.cashSales = byPaymentMethod.cash.total
  return summary
}

// 現金を数えた結果。数えていないとき（countedCash が空）は差額を出さない。
export function calculateCashCount({ cashSales, openingCash, countedCash }) {
  const opening = Math.max(0, money(openingCash))
  const expectedCash = opening + money(cashSales)
  const counted = countedCash === null || countedCash === undefined || countedCash === ''
    ? null
    : Math.max(0, money(countedCash))
  return {
    openingCash: opening,
    expectedCash,
    countedCash: counted,
    cashDifference: counted === null ? null : counted - expectedCash,
  }
}
