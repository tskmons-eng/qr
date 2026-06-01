import assert from 'node:assert/strict'
import {
  buildAdminCategoryActivePayload,
  buildAdminCategoryPayload,
  normalizeAdminCategoryName,
  sortAdminCategories,
} from '../src/lib/adminCategory.js'

assert.equal(normalizeAdminCategoryName('  Food  '), 'Food')
assert.deepEqual(sortAdminCategories([{ id: 'b', sortOrder: 2 }, { id: 'a', sortOrder: 1 }]).map(item => item.id), ['a', 'b'])

const timestamp = { seconds: 1 }
assert.deepEqual(buildAdminCategoryPayload({
  storeId: 'store-1',
  name: ' Drinks ',
  sortOrder: 3,
  timestamp,
}), {
  storeId: 'store-1',
  name: 'Drinks',
  sortOrder: 3,
  isActive: true,
  createdAt: timestamp,
  updatedAt: timestamp,
})
assert.deepEqual(buildAdminCategoryActivePayload({ isActive: true }, timestamp), {
  isActive: false,
  updatedAt: timestamp,
})

console.log('admin category checks passed')
