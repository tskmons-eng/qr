import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildAssigneeSummaryExportRows,
  buildAttributedSalesExportRows,
  buildSalesExportFilename,
  buildSalesExportRows,
  calculateAttributionSummary,
  calculateSalesSummary,
  filterChecksByAssignee,
  filterChecksByDateRange,
  filterCompletedChecks,
  filterTodayChecks,
  formatSalesTimestamp,
  getBusinessDate,
  getMonthDateRange,
  isSameBusinessDay,
  joinChecksWithAttributions,
  sortCashClosingsByBusinessDateDesc,
  sortChecksByCompletedAtDesc,
} from '../src/lib/adminSales.js'

const baseDate = new Date('2026-05-09T03:00:00.000Z')
const todayTimestamp = { seconds: 30, toDate: () => new Date('2026-05-09T09:30:00.000Z') }
const oldTimestamp = { seconds: 10, toDate: () => new Date('2026-05-08T09:30:00.000Z') }

assert.equal(getBusinessDate(baseDate), '2026-05-09')
assert.deepEqual(getMonthDateRange(baseDate), { startDate: '2026-05-01', endDate: '2026-05-31' })
assert.equal(isSameBusinessDay(todayTimestamp, baseDate), true)
assert.equal(isSameBusinessDay(oldTimestamp, baseDate), false)

const beforeTokyoMay = new Date('2026-04-30T14:59:59.000Z')
const tokyoMayStart = new Date('2026-04-30T15:00:00.000Z')
const tokyoMayMiddle = new Date('2026-04-30T15:30:00.000Z')
const tokyoMayEnd = new Date('2026-05-31T14:59:59.000Z')
const tokyoJuneStart = new Date('2026-05-31T15:00:00.000Z')
assert.equal(getBusinessDate(beforeTokyoMay), '2026-04-30')
assert.equal(getBusinessDate(tokyoMayStart), '2026-05-01')
assert.equal(getBusinessDate(tokyoMayMiddle), '2026-05-01')
assert.equal(getBusinessDate(tokyoMayEnd), '2026-05-31')
assert.equal(getBusinessDate(tokyoJuneStart), '2026-06-01')
assert.deepEqual(getMonthDateRange(tokyoMayStart), { startDate: '2026-05-01', endDate: '2026-05-31' })
assert.deepEqual(getMonthDateRange(tokyoJuneStart), { startDate: '2026-06-01', endDate: '2026-06-30' })
assert.match(formatSalesTimestamp(tokyoMayMiddle), /2026\/05\/01.*00:30/)
assert.match(formatSalesTimestamp(tokyoMayMiddle, { includeDate: false }), /00:30/)

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

const rangeChecks = [
  { id: 'april', completedAt: { toDate: () => new Date('2026-04-30T14:59:00.000Z') }, total: 900 },
  { id: 'may-start', completedAt: { toDate: () => new Date('2026-04-30T15:00:00.000Z') }, total: 1000 },
  { id: 'may-end', completedAt: { toDate: () => new Date('2026-05-31T14:59:00.000Z') }, total: 1200 },
  { id: 'june', completedAt: { toDate: () => new Date('2026-05-31T15:00:00.000Z') }, total: 1300 },
]
assert.deepEqual(
  filterChecksByDateRange(rangeChecks, { startDate: '2026-05-01', endDate: '2026-05-31' }).map(check => check.id),
  ['may-start', 'may-end']
)
assert.deepEqual(filterChecksByDateRange(rangeChecks, {}).map(check => check.id), ['april', 'may-start', 'may-end', 'june'])

const assignees = [
  { id: 'a1', name: '現在名', isActive: true },
  { id: 'a2', name: '無効担当', isActive: false },
]
const attributedChecks = joinChecksWithAttributions([
  { id: 'c1', total: 1000, guestCount: 2, completedAt: { seconds: 3 } },
  { id: 'c2', total: 2500, guestCount: 3, completedAt: { seconds: 2 } },
  { id: 'c3', total: 700, guestCount: 1, completedAt: { seconds: 1 } },
], [
  { id: 'c1', checkId: 'c1', status: 'assigned', assigneeId: 'a1', assigneeNameSnapshot: '旧名' },
  { id: 'c2', checkId: 'c2', status: 'assigned', assigneeId: 'a2', assigneeNameSnapshot: '無効担当' },
  { id: 'c3', checkId: 'c3', status: 'unassigned', assigneeId: null, assigneeNameSnapshot: null },
], assignees)
assert.equal(attributedChecks[0].salesAssigneeName, '現在名')
assert.equal(attributedChecks[1].salesAssignee?.isActive, false)
assert.equal(attributedChecks[2].isSalesAssigned, false)
assert.deepEqual(filterChecksByAssignee(attributedChecks, 'a1').map(check => check.id), ['c1'])
assert.deepEqual(filterChecksByAssignee(attributedChecks, 'unassigned').map(check => check.id), ['c3'])

const attributionSummary = calculateAttributionSummary(attributedChecks, assignees)
assert.equal(attributionSummary.salesTotal, 4200)
assert.deepEqual(attributionSummary.assignees.map(item => [item.assigneeId, item.checkCount, item.salesTotal]), [
  ['a2', 1, 2500],
  ['a1', 1, 1000],
])
assert.deepEqual(attributionSummary.unassigned, {
  assigneeId: null,
  assigneeName: '担当未設定',
  checkCount: 1,
  salesTotal: 700,
})
const attributedRows = buildAttributedSalesExportRows(attributedChecks, () => '日時')
assert.equal(attributedRows[0][2], '担当')
assert.equal(attributedRows[1][2], '現在名')
const summaryRows = buildAssigneeSummaryExportRows(attributionSummary)
assert.deepEqual(summaryRows.at(-1), ['合計', 3, 4200])

const salesService = readFileSync(new URL('../src/services/salesHistoryService.js', import.meta.url), 'utf8')
assert.match(salesService, /Object\.prototype\.hasOwnProperty\.call\(check, 'checkoutItemIds'\)/)
assert.match(salesService, /item\.itemStatus !== 'cancelled'/)
assert.match(salesService, /runTransaction\(db,[\s\S]*actionType: 'sales_attribution'/)
assert.match(salesService, /lastAuditActionId: actionRef\.id/)
assert.match(salesService, /hasSubtotalMismatch/)
assert.match(salesService, /assignee-update-conflict/)
assert.match(salesService, /actorUid: authUser\?\.uid \?\? null/)
assert.doesNotMatch(salesService, /deleteDoc\(/)

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
assert.match(rules, /match \/salesAssignees\/\{assigneeId\}[\s\S]*allow create: if canManageStaff\([\s\S]*allow delete: if false;/)
assert.match(rules, /match \/salesAttributions\/\{checkId\}[\s\S]*allow create: if canCloseRegister\([\s\S]*allow delete: if false;/)
assert.match(rules, /data\.checkId == checkId/)
assert.match(rules, /documents\/salesAssignees\/\$\(data\.assigneeId\)[\s\S]*isActive == true/)
assert.match(rules, /function canonicalStaffMemberExists\(storeId\)/)
assert.match(rules, /function canonicalStaffPermission\(memberData, permission, legacyDefault\)/)
assert.match(rules, /validActivatedStaffSession\(request\.resource\.data\)/)
assert.match(rules, /data\.get\(prefix \+ 'ByUid', null\) == request\.auth\.uid/)
assert.match(rules, /lastAuditActionId/)
assert.match(rules, /data\.isActive != previousData\.isActive\s*&& data\.name == previousData\.name/)
assert.match(rules, /getAfter\(\/databases\/\$\(database\)\/documents\/staffActions\/\$\(actionId\)\)/)
assert.match(rules, /sales_assignee', 'sales_attribution'[\s\S]*allow delete:/)

console.log('admin sales checks passed')
