import assert from 'node:assert/strict'
import {
  applyCustomerOrderStartToTable,
  CUSTOMER_ENTRY_CONFIG_DEFAULTS,
  normalizeCustomerStoreConfig,
  stepGuestCount,
} from '../src/lib/customerEntry.js'

assert.deepEqual(normalizeCustomerStoreConfig({ showItemPrice: false }), {
  ...CUSTOMER_ENTRY_CONFIG_DEFAULTS,
  showItemPrice: false,
})
assert.deepEqual(normalizeCustomerStoreConfig({ guestAutoAdd: { enabled: true, productId: 'p1' } }).guestAutoAdd, {
  ...CUSTOMER_ENTRY_CONFIG_DEFAULTS.guestAutoAdd,
  enabled: true,
  productId: 'p1',
})
assert.equal(stepGuestCount(2, -1), 1)
assert.equal(stepGuestCount(1, -1), 1)
assert.equal(stepGuestCount(20, 1), 20)
assert.equal(stepGuestCount(19, 1), 20)
assert.deepEqual(applyCustomerOrderStartToTable({ id: 'table-1', tableName: 'A' }, 3, 'order-1'), {
  id: 'table-1',
  tableName: 'A',
  status: 'occupied',
  guestCount: 3,
  currentOrderId: 'order-1',
})

console.log('customer entry checks passed')
