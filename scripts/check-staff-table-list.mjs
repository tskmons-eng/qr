import assert from 'node:assert/strict'
import { countPendingOrderItems, formatElapsed, getStaffTablePending, getStaffTableStatusKey } from '../src/lib/staffTableList.js'

assert.equal(formatElapsed(1000, 1000 * 1000 + 30000), '1分未満')
assert.equal(formatElapsed(1000, 1000 * 1000 + 5 * 60000), '5分')
assert.equal(formatElapsed(1000, 1000 * 1000 + 2 * 3600000 + 3 * 60000), '2時間3分')

assert.deepEqual(countPendingOrderItems([
  { tableId: 't1', categoryGroup: 'drink' },
  { tableId: 't1', categoryGroup: 'food' },
  { tableId: 't1', categoryGroup: 'other' },
  { tableId: 't2', categoryGroup: 'drink' },
  { categoryGroup: 'drink' },
]), {
  t1: { total: 3, drink: 1, food: 1 },
  t2: { total: 1, drink: 1, food: 0 },
})

assert.equal(getStaffTableStatusKey({ status: 'occupied' }, { total: 2 }), 'occupied_pending')
assert.equal(getStaffTableStatusKey({ status: 'occupied' }, { total: 0 }), 'occupied')
assert.equal(getStaffTableStatusKey({}, { total: 0 }), 'vacant')

assert.deepEqual(getStaffTablePending({
  id: 't1',
  status: 'occupied',
  currentOrderId: 'o1',
}, {
  t1: { total: 2, drink: 1, food: 1 },
}), { total: 2, drink: 1, food: 1 })

assert.deepEqual(getStaffTablePending({
  status: 'occupied',
  currentOrderId: 'o1',
  pendingAggregateVersion: 1,
  pendingAggregateCount: 3,
  pendingAggregateDrinkCount: 2,
  pendingAggregateFoodCount: 1,
}), { total: 3, drink: 2, food: 1 })

console.log('staff table list checks passed')
