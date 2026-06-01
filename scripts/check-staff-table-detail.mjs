import assert from 'node:assert/strict'
import {
  calculateTableOrderTotal,
  filterVisibleOrderItems,
  formatTableOrderOptions,
  sortOrderItemsByOrderedAt,
  splitTableOrderItems,
  stepGuestInputValue,
} from '../src/lib/staffTableDetail.js'

const items = [
  { id: 'served', itemStatus: 'served', lineTotal: 500, orderedAt: { seconds: 20 } },
  { id: 'cancelled', itemStatus: 'cancelled', lineTotal: 300, orderedAt: { seconds: 5 } },
  { id: 'ordered', itemStatus: 'ordered', lineTotal: 800, orderedAt: { seconds: 10 } },
]

assert.deepEqual(filterVisibleOrderItems(items).map(item => item.id), ['served', 'ordered'])
assert.deepEqual(sortOrderItemsByOrderedAt(filterVisibleOrderItems(items)).map(item => item.id), ['ordered', 'served'])
assert.deepEqual(splitTableOrderItems(filterVisibleOrderItems(items)), {
  orderedItems: [items[2]],
  servedItems: [items[0]],
})
assert.equal(calculateTableOrderTotal(filterVisibleOrderItems(items)), 1300)
assert.equal(stepGuestInputValue('3', 1), '4')
assert.equal(stepGuestInputValue('0', -1), '0')
assert.equal(stepGuestInputValue('', -1), '0')
assert.equal(formatTableOrderOptions([{ choice: 'hot' }, { choice: 'large' }]), 'hot · large')
assert.equal(formatTableOrderOptions([]), null)

console.log('staff table detail checks passed')
