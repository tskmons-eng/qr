import assert from 'node:assert/strict'
import {
  buildDiscountHistoryItems,
  buildHistoryExportFilename,
  buildHistoryExportRows,
  filterHistoryItems,
  mergeHistoryItems,
} from '../src/lib/adminHistory.js'

const oldTimestamp = { seconds: 10, toDate: () => new Date(2026, 4, 9, 10, 0, 0) }
const newTimestamp = { seconds: 20, toDate: () => new Date(2026, 4, 9, 11, 0, 0) }

const checks = [
  { id: 'normal', total: 1000, discountAmount: 0, completedAt: oldTimestamp },
  { id: 'discounted', total: 1200, discountAmount: 200, discountNote: 'coupon', closedByStaffName: 'Staff', completedAt: newTimestamp },
]
const discountItems = buildDiscountHistoryItems(checks)
assert.equal(discountItems.length, 1)
assert.equal(discountItems[0].actionType, 'checkout_discount')
assert.equal(discountItems[0].note, '¥1,200 (割引 −¥200 / coupon)')

const merged = mergeHistoryItems([{ id: 'action', actionType: 'seat_guests', createdAt: oldTimestamp }], checks)
assert.deepEqual(merged.map(item => item.id), ['discounted', 'action'])
assert.equal(filterHistoryItems(merged, 'seat_guests').length, 1)
assert.equal(filterHistoryItems(merged, 'all').length, 2)

const rows = buildHistoryExportRows(merged, () => 'date')
assert.deepEqual(rows[0], ['日時', '種別', 'スタッフ', '内容'])
assert.equal(rows[1][1], '割引会計')
assert.equal(buildHistoryExportFilename(new Date(2026, 4, 9)), '操作履歴_2026-5-9.csv')

console.log('admin history checks passed')
