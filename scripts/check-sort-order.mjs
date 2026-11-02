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

// 動かしたものだけ書く（前後の間の並び順）。
assert.deepEqual(reorderById(items, 'a', 'c'), {
  next: [
    { id: 'b', sortOrder: 1 },
    { id: 'c', sortOrder: 2 },
    { id: 'a', sortOrder: 3 },
  ],
  updates: [{ id: 'a', sortOrder: 3 }],
})
assert.deepEqual(reorderById(items, 'c', 'a').updates, [{ id: 'c', sortOrder: -1 }])
assert.deepEqual(reorderById([{ id: 'a', sortOrder: 0 }, { id: 'b', sortOrder: 4 }, { id: 'c', sortOrder: 8 }], 'c', 'b').updates, [{ id: 'c', sortOrder: 2 }])
assert.deepEqual(reorderById(items, 'c', 'b').updates, [{ id: 'c', sortOrder: 0.5 }])

// 前後の間が無い（同じ並び順）ときは振り直し、変わった分だけ書く。
assert.deepEqual(reorderById([{ id: 'a', sortOrder: 0 }, { id: 'b', sortOrder: 1 }, { id: 'c', sortOrder: 1 }, { id: 'd', sortOrder: 3 }], 'd', 'c').updates, [
  { id: 'd', sortOrder: 2 },
  { id: 'c', sortOrder: 3 },
])

// 並び順が無いものがあるときは、今までどおり全体を振り直す（変わった分だけ）。
assert.deepEqual(reorderById([{ id: 'a', sortOrder: 0 }, { id: 'b' }, { id: 'c' }], 'c', 'b').updates, [
  { id: 'c', sortOrder: 1 },
  { id: 'b', sortOrder: 2 },
])

// 500件を超えても、1回に書くのは1件。
const many = Array.from({ length: 800 }, (_, index) => ({ id: `p${index}`, sortOrder: index }))
assert.equal(reorderById(many, 'p799', 'p0').updates.length, 1)

assert.equal(reorderById(items, 'a', 'a'), null)

console.log('sort order checks passed')
