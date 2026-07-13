import assert from 'node:assert/strict'
import {
  buildDiscountHistoryItems,
  buildHistoryExportFilename,
  buildHistoryExportRows,
  filterHistoryItems,
  getHistoryActionLabel,
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

const recordedDiscountAction = {
  id: 'recorded-discount',
  actionType: 'checkout_discount',
  targetType: 'check',
  targetId: 'discounted',
  createdAt: newTimestamp,
}
const deduped = mergeHistoryItems([
  recordedDiscountAction,
  { ...recordedDiscountAction, id: 'duplicate-discount', createdAt: oldTimestamp },
], checks)
assert.deepEqual(deduped.map(item => item.id), ['recorded-discount'])

const upgradedLegacyDiscount = mergeHistoryItems([{
  id: 'legacy-checkout',
  actionType: 'checkout',
  targetType: 'check',
  targetId: 'discounted',
  note: '会計完了 ¥1,200',
  createdAt: newTimestamp,
}], checks)
assert.equal(upgradedLegacyDiscount.length, 1)
assert.equal(upgradedLegacyDiscount[0].id, 'legacy-checkout')
assert.equal(upgradedLegacyDiscount[0].actionType, 'checkout_discount')
assert.equal(upgradedLegacyDiscount[0].note, '¥1,200 (割引 −¥200 / coupon)')

const attributionItem = {
  id: 'attribution',
  actionType: 'sales_attribution',
  changeType: 'change',
  targetType: 'check',
  targetId: 'discounted',
  checkId: 'discounted',
  note: '担当を「A」から「B」に変更',
  createdAt: newTimestamp,
}
assert.equal(filterHistoryItems([attributionItem], 'sales_attribution').length, 1)
assert.equal(getHistoryActionLabel({ ...attributionItem, changeType: 'set' }), '担当設定')
assert.equal(getHistoryActionLabel(attributionItem), '担当変更')
assert.equal(getHistoryActionLabel({ ...attributionItem, changeType: 'clear' }), '担当解除')
assert.equal(getHistoryActionLabel({ actionType: 'sales_assignee', changeType: 'deactivate' }), '担当者無効化')
assert.equal(getHistoryActionLabel({ actionType: 'seat_reservation' }), '予約着席')

const rows = buildHistoryExportRows(merged, () => 'date')
assert.deepEqual(rows[0], ['日時', '種別', 'スタッフ', '内容'])
assert.equal(rows[1][1], '割引会計')
const attributionRows = buildHistoryExportRows([attributionItem], () => 'date')
assert.equal(attributionRows[1][1], '担当変更')
assert.equal(buildHistoryExportFilename(new Date(2026, 4, 9)), '操作ログ_2026-5-9.csv')

console.log('admin history checks passed')
