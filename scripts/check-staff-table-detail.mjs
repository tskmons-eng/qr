import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
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

const orderStyles = await readFile('src/styles/staff-table-orders.css', 'utf8')
const shellStyles = await readFile('src/styles/staff-table-shell.css', 'utf8')
const tableDetailPage = await readFile('src/pages/staff/TableDetailPage.jsx', 'utf8')

assert.ok(orderStyles.includes('flex-wrap: wrap'), 'staff table order rows should wrap instead of overflowing action buttons')
assert.ok(orderStyles.includes('.staff-table-order-row.is-served .staff-table-row-button'), 'served rows should have compact action buttons')
assert.ok(orderStyles.includes('overflow-wrap: anywhere'), 'long order names/options should wrap inside staff table rows')
assert.ok(tableDetailPage.includes('className="staff-table-content-scroll"'), 'staff table detail should scroll order content separately from fixed actions')
assert.ok(shellStyles.includes('.staff-table-content-scroll'), 'staff table detail should define a bounded content scroll region')
assert.ok(shellStyles.includes('overflow-y: auto'), 'staff table detail content should scroll internally')
assert.ok(shellStyles.includes('bottom: var(--staff-bottom-nav-offset, 74px)'), 'staff table action bar should avoid the bottom nav')

console.log('staff table detail checks passed')
