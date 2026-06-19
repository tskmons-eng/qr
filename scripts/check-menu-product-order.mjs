import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { sortSoldOutProductsLast } from '../src/lib/menuProductOrder.js'

const products = [
  { id: 'regular-1', sortOrder: 1 },
  { id: 'sold-out-1', sortOrder: 2, isSoldOut: true },
  { id: 'regular-2', sortOrder: 3 },
  { id: 'sold-out-2', sortOrder: 4, isSoldOut: true },
]

const sorted = sortSoldOutProductsLast(products)

assert.deepEqual(
  sorted.map(product => product.id),
  ['regular-1', 'regular-2', 'sold-out-1', 'sold-out-2'],
  'sold-out products should move after available products'
)
assert.deepEqual(
  sorted.filter(product => product.isSoldOut).map(product => product.id),
  ['sold-out-1', 'sold-out-2'],
  'sold-out products should preserve their existing relative order'
)
assert.deepEqual(
  sorted.filter(product => !product.isSoldOut).map(product => product.id),
  ['regular-1', 'regular-2'],
  'available products should preserve their existing relative order'
)
assert.deepEqual(
  products.map(product => product.id),
  ['regular-1', 'sold-out-1', 'regular-2', 'sold-out-2'],
  'sorting should not mutate the source array'
)

const [customerMenuPage, staffMenuPage] = await Promise.all([
  readFile('src/pages/order/MenuPage.jsx', 'utf8'),
  readFile('src/pages/staff/StaffMenuPage.jsx', 'utf8'),
])

for (const [label, source] of [
  ['customer menu', customerMenuPage],
  ['staff menu', staffMenuPage],
]) {
  assert.ok(source.includes('sortSoldOutProductsLast'), `${label} should sort sold-out products last`)
  assert.ok(source.includes('productMatchesCategory'), `${label} should keep category filtering`)
}

console.log('menu product order checks passed')
