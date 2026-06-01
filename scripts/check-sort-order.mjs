import assert from 'node:assert/strict'
import { reorderById, swapSortOrderById } from '../src/lib/sortOrder.js'

const items = [
  { id: 'a', sortOrder: 0 },
  { id: 'b', sortOrder: 1 },
  { id: 'c', sortOrder: 2 },
]

assert.deepEqual(swapSortOrderById(items, 'b', -1), {
  next: [
    { id: 'b', sortOrder: 0 },
    { id: 'a', sortOrder: 1 },
    { id: 'c', sortOrder: 2 },
  ],
  updates: [
    { id: 'b', sortOrder: 0 },
    { id: 'a', sortOrder: 1 },
  ],
})

assert.equal(swapSortOrderById(items, 'a', -1), null)

assert.deepEqual(reorderById(items, 'a', 'c'), {
  next: [
    { id: 'b', sortOrder: 0 },
    { id: 'c', sortOrder: 1 },
    { id: 'a', sortOrder: 2 },
  ],
  updates: [
    { id: 'b', sortOrder: 0 },
    { id: 'c', sortOrder: 1 },
    { id: 'a', sortOrder: 2 },
  ],
})

assert.equal(reorderById(items, 'a', 'a'), null)

console.log('sort order checks passed')
