import assert from 'node:assert/strict'
import {
  buildKitchenTableGroups,
  filterKitchenItemsByGroup,
  findNewKitchenItems,
  formatKitchenElapsed,
  getKitchenWaitLevel,
  sortKitchenItemsByOrderedAt,
} from '../src/lib/kitchenDisplay.js'

const now = new Date(2026, 4, 9, 12, 30, 0).getTime()
const timestamp = minutesAgo => ({
  seconds: Math.floor((now - minutesAgo * 60000) / 1000),
  toDate: () => new Date(now - minutesAgo * 60000),
})

assert.equal(formatKitchenElapsed(timestamp(0), now), '0秒')
assert.equal(formatKitchenElapsed(timestamp(7), now), '7分')
assert.equal(formatKitchenElapsed(timestamp(65), now), '1時間5分')
assert.equal(getKitchenWaitLevel(timestamp(7), now), 'normal')
assert.equal(getKitchenWaitLevel(timestamp(8), now), 'warning')
assert.equal(getKitchenWaitLevel(timestamp(15), now), 'urgent')

const items = [
  { id: 'food-2', orderId: 'order-1', categoryGroup: 'food', orderedAt: timestamp(2) },
  { id: 'drink-1', orderId: 'order-1', categoryGroup: 'drink', orderedAt: timestamp(10) },
  { id: 'food-1', orderId: 'order-2', categoryGroup: 'food', orderedAt: timestamp(20) },
]
const tables = [
  { id: 'table-1', currentOrderId: 'order-1' },
  { id: 'table-2', currentOrderId: 'order-2' },
  { id: 'table-3' },
]

assert.deepEqual(filterKitchenItemsByGroup(items, 'drink').map(item => item.id), ['drink-1'])
assert.deepEqual(sortKitchenItemsByOrderedAt([items[0], items[1]]).map(item => item.id), ['drink-1', 'food-2'])
assert.deepEqual(buildKitchenTableGroups({ tables, pendingItems: items, filterGroup: 'all' }).map(group => group.table.id), ['table-2', 'table-1'])
assert.deepEqual(buildKitchenTableGroups({ tables, pendingItems: items, filterGroup: 'drink' }).map(group => group.table.id), ['table-1'])
assert.deepEqual(findNewKitchenItems(items, new Set(['food-2']), 'food').map(item => item.id), ['food-1'])
assert.deepEqual(findNewKitchenItems(items, null, 'all'), [])

console.log('kitchen display checks passed')
