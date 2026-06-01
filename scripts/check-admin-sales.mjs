import assert from 'node:assert/strict'
import {
  buildSalesExportFilename,
  buildSalesExportRows,
  calculateSalesSummary,
  filterCompletedChecks,
  filterTodayChecks,
  getBusinessDate,
  isSameBusinessDay,
  sortCashClosingsByBusinessDateDesc,
  sortChecksByCompletedAtDesc,
} from '../src/lib/adminSales.js'

const baseDate = new Date(2026, 4, 9, 12, 0, 0)
const todayTimestamp = { seconds: 30, toDate: () => new Date(2026, 4, 9, 18, 30, 0) }
const oldTimestamp = { seconds: 10, toDate: () => new Date(2026, 4, 8, 18, 30, 0) }

assert.equal(getBusinessDate(baseDate), '2026-05-09')
assert.equal(isSameBusinessDay(todayTimestamp, baseDate), true)
assert.equal(isSameBusinessDay(oldTimestamp, baseDate), false)

const checks = [
  { id: 'open', status: 'open', completedAt: todayTimestamp, total: 1000, guestCount: 2 },
  { id: 'old', status: 'completed', completedAt: oldTimestamp, total: 800, guestCount: 1 },
  { id: 'today', status: 'completed', completedAt: todayTimestamp, total: 1200, guestCount: 3 },
]

assert.deepEqual(filterCompletedChecks(checks).map(check => check.id), ['old', 'today'])
assert.deepEqual(filterTodayChecks(filterCompletedChecks(checks), baseDate).map(check => check.id), ['today'])
assert.deepEqual(sortChecksByCompletedAtDesc(filterCompletedChecks(checks)).map(check => check.id), ['today', 'old'])
assert.deepEqual(calculateSalesSummary(filterCompletedChecks(checks)), {
  salesTotal: 2000,
  customerCount: 4,
  checkCount: 2,
  averageSpend: 1000,
})

const rows = buildSalesExportRows([
  {
    completedAt: todayTimestamp,
    closedByStaffName: 'Staff',
    guestCount: 3,
    subtotal: 1400,
    discountAmount: 200,
    discountNote: 'coupon',
    total: 1200,
    receivedCash: 2000,
    changeAmount: 800,
    paymentMethod: '現金',
  },
], () => '2026/05/09 18:30')
assert.equal(rows[0][0], '日時')
assert.equal(rows[1][0], '2026/05/09 18:30')
assert.equal(rows[1][5], 'coupon')
assert.equal(buildSalesExportFilename(baseDate), '売上履歴_2026-5-9.csv')
assert.deepEqual(sortCashClosingsByBusinessDateDesc([{ businessDate: '2026-05-08' }, { businessDate: '2026-05-09' }]).map(item => item.businessDate), ['2026-05-09', '2026-05-08'])

console.log('admin sales checks passed')
