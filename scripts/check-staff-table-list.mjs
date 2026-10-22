import assert from 'node:assert/strict'
import { buildStaffTableBoard, countPendingOrderItems, formatAgo, formatElapsed, getStaffTablePending, getStaffTableStatusKey } from '../src/lib/staffTableList.js'

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

// 2026-10-22 作り直し：対応が要る席（呼び出し・会計の依頼・未提供）を上に、利用中・空席を分ける。
const aggregate = count => ({ status: 'occupied', currentOrderId: 'o', pendingAggregateVersion: 1, pendingAggregateCount: count, pendingAggregateFoodCount: count, pendingAggregateDrinkCount: 0 })
const board = buildStaffTableBoard({
  tables: [
    { id: 'a', tableName: 'A', ...aggregate(0), startedAt: { seconds: 100 } },
    { id: 'b', tableName: 'B', ...aggregate(2), startedAt: { seconds: 50 } },
    { id: 'c', tableName: 'C', ...aggregate(0), startedAt: { seconds: 10 } },
    { id: 'd', tableName: 'D', status: 'vacant' },
  ],
  calls: [
    { tableId: 'c', type: 'checkout', createdAt: { seconds: 300 } },
    { tableId: 'a', type: 'call', createdAt: { seconds: 200 } },
    { tableId: 'd', type: 'call', createdAt: { seconds: 400 } },
  ],
})
assert.deepEqual(board.needs.map(need => need.table.id), ['a', 'c', 'd', 'b'], 'calls first by age, then pending tables')
assert.equal(board.needs[0].hasCall, true)
assert.equal(board.needs[1].hasCheckoutRequest, true)
assert.equal(board.needs[3].pendingDetail, 'フード2')
assert.deepEqual(board.counts, { all: 4, needs: 4, occupied: 3, vacant: 1 })
assert.equal(formatAgo(0, 1000), '')
assert.equal(formatAgo(100, 100_000 + 30_000), 'たった今')
assert.equal(formatAgo(100, 100_000 + 5 * 60_000), '5分前')

console.log('staff table list checks passed')
