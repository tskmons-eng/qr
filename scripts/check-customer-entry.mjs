import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  applyCustomerOrderStartToTable,
  CUSTOMER_ENTRY_CONFIG_DEFAULTS,
  getCustomerEntryStartPath,
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
assert.equal(getCustomerEntryStartPath(null), 'guests')
assert.equal(getCustomerEntryStartPath('order-1'), 'menu')
assert.deepEqual(applyCustomerOrderStartToTable({ id: 'table-1', tableName: 'A' }, 3, 'order-1'), {
  id: 'table-1',
  tableName: 'A',
  status: 'occupied',
  guestCount: 3,
  currentOrderId: 'order-1',
})

const orderEntrySource = readFileSync(new URL('../src/pages/order/OrderEntryPage.jsx', import.meta.url), 'utf8')
assert.match(orderEntrySource, /const \[configLoading, setConfigLoading\] = useState\(true\)/)
assert.match(orderEntrySource, /setStoreConfig\(CUSTOMER_ENTRY_CONFIG_DEFAULTS\)/)
assert.match(orderEntrySource, /if \(loading \|\| configLoading \|\| error\)/)
assert.match(orderEntrySource, /<OrderEntryStatus loading=\{loading \|\| configLoading\} error=\{error\} \/>/)

console.log('customer entry checks passed')
