import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  addOptimisticHiddenKitchenItemIds,
  buildKitchenTableGroups,
  filterOptimisticHiddenKitchenItems,
  filterKitchenItemsByGroup,
  findNewKitchenItems,
  formatKitchenElapsed,
  formatKitchenOrderOptions,
  getKitchenWaitLevel,
  pruneOptimisticHiddenKitchenItemIds,
  removeOptimisticHiddenKitchenItemIds,
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
assert.equal(formatKitchenOrderOptions([{ groupName: 'タレ', choice: '塩' }, { groupName: '麺', choice: '固め' }]), 'タレ: 塩 · 麺: 固め')
assert.equal(formatKitchenOrderOptions([{ choice: 'Large' }, { choice: 'No onion' }]), 'Large · No onion')
assert.equal(formatKitchenOrderOptions([{ groupName: '味付け', choice: '   ' }]), null)
assert.equal(formatKitchenOrderOptions([]), null)
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

const hiddenSingle = addOptimisticHiddenKitchenItemIds(new Set(), ['food-2'])
assert.deepEqual([...hiddenSingle], ['food-2'])
assert.deepEqual(filterOptimisticHiddenKitchenItems(items, hiddenSingle).map(item => item.id), ['drink-1', 'food-1'])

const hiddenAll = addOptimisticHiddenKitchenItemIds(hiddenSingle, ['drink-1', 'food-1'])
assert.deepEqual(
  buildKitchenTableGroups({
    tables,
    pendingItems: filterOptimisticHiddenKitchenItems(items, hiddenAll),
    filterGroup: 'all',
  }),
  []
)

const rollbackOne = removeOptimisticHiddenKitchenItemIds(hiddenAll, ['food-1'])
assert.deepEqual([...rollbackOne], ['food-2', 'drink-1'])
assert.deepEqual(filterOptimisticHiddenKitchenItems(items, rollbackOne).map(item => item.id), ['food-1'])

const cleanedAfterSubscription = pruneOptimisticHiddenKitchenItemIds(hiddenAll, [{ id: 'drink-1' }])
assert.deepEqual([...cleanedAfterSubscription], ['drink-1'])
assert.equal(pruneOptimisticHiddenKitchenItemIds(cleanedAfterSubscription, [{ id: 'drink-1' }]), cleanedAfterSubscription)

const [kitchenItemRow, kitchenCss] = await Promise.all([
  readFile('src/components/staff/KitchenItemRow.jsx', 'utf8'),
  readFile('src/styles/staff-kitchen-table.css', 'utf8'),
])

assert.ok(kitchenItemRow.includes('formatKitchenOrderOptions(item.optionSelections)'), 'Kitchen row should format order item options')
assert.ok(kitchenItemRow.includes('staff-kitchen-item__options'), 'Kitchen row should render option text')
assert.ok(kitchenCss.includes('.staff-kitchen-item__options'), 'Kitchen CSS should style option text')
assert.ok(kitchenCss.includes('overflow-wrap: anywhere'), 'Kitchen option labels should wrap instead of widening the row')

console.log('kitchen display checks passed')
