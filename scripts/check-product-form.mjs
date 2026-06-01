import assert from 'node:assert/strict'
import {
  buildCategoryPayload,
  buildCategoryUpdatePayload,
  buildNewProductPayload,
  buildOptionsUpdatePayload,
  buildProductUpdatePayload,
  buildQuickCategoryPayload,
  buildRelatedProductsUpdatePayload,
  cleanDiscountConfig,
  cleanOptionGroups,
  discountLabel,
  mergeTagsInput,
  normalizeChoices,
  normalizeDiscountConfig,
} from '../src/lib/productForm.js'

assert.deepEqual(normalizeChoices(['Hot', { label: 'Cold', extraPrice: '50' }]), [
  { label: 'Hot', extraPrice: 0 },
  { label: 'Cold', extraPrice: '50' },
])

assert.deepEqual(cleanOptionGroups([
  { groupName: ' Size ', required: false, choices: [{ label: ' M ', extraPrice: '100' }, { label: ' ', extraPrice: 10 }] },
  { groupName: '', choices: [{ label: 'No group', extraPrice: 0 }] },
]), [
  { groupName: 'Size', required: false, choices: [{ label: 'M', extraPrice: 100 }] },
])

assert.deepEqual(normalizeDiscountConfig({ enabled: true, value: 20 }), {
  enabled: true,
  type: 'amount',
  value: '20',
  startDate: '',
  endDate: '',
  weekdays: [],
})

assert.deepEqual(cleanDiscountConfig({ enabled: true, type: 'percent', value: '15', weekdays: [1, 5] }), {
  enabled: true,
  type: 'percent',
  value: 15,
  startDate: '',
  endDate: '',
  weekdays: [1, 5],
})

assert.equal(discountLabel({ enabled: true, type: 'amount', value: 300 }), '\u00A5300OFF')
assert.equal(mergeTagsInput('lunch, spicy', ['spicy', 'drink']), 'lunch, spicy, drink')

const timestamp = { mock: 'serverTimestamp' }
const form = {
  name: ' Lunch Set ',
  price: '1200',
  categoryId: 'cat-main',
  isVisible: true,
  isSoldOut: false,
  optionsEnabled: true,
  options: [
    { groupName: ' Drink ', choices: [{ label: ' Coffee ', extraPrice: '100' }] },
  ],
  linkedEnabled: true,
  linkedProductIds: ['p-side'],
  displayCategoryIds: ['cat-main', 'cat-sub'],
  tagsInput: 'lunch, popular',
  discountConfig: { enabled: true, type: 'amount', value: '100' },
}

assert.deepEqual(buildNewProductPayload({ storeId: 'store-1', form, sortOrder: 3, timestamp }), {
  storeId: 'store-1',
  name: 'Lunch Set',
  price: 1200,
  categoryId: 'cat-main',
  isVisible: true,
  isSoldOut: false,
  sortOrder: 3,
  createdAt: timestamp,
  updatedAt: timestamp,
})

assert.deepEqual(buildProductUpdatePayload({ form, imageUrl: 'https://example.test/image.jpg', timestamp }), {
  name: 'Lunch Set',
  price: 1200,
  categoryId: 'cat-main',
  displayCategoryIds: ['cat-sub'],
  tags: ['lunch', 'popular'],
  isVisible: true,
  isSoldOut: false,
  options: [
    { groupName: 'Drink', required: true, choices: [{ label: 'Coffee', extraPrice: 100 }] },
  ],
  discountConfig: {
    enabled: true,
    type: 'amount',
    value: 100,
    startDate: '',
    endDate: '',
    weekdays: [],
  },
  linkedProductIds: ['p-side'],
  imageUrl: 'https://example.test/image.jpg',
  updatedAt: timestamp,
})

assert.deepEqual(buildOptionsUpdatePayload({ form: { ...form, optionsEnabled: false }, timestamp }), {
  options: [],
  updatedAt: timestamp,
})

assert.deepEqual(buildRelatedProductsUpdatePayload({ form: { ...form, linkedEnabled: false }, timestamp }), {
  linkedProductIds: [],
  updatedAt: timestamp,
})

assert.deepEqual(buildQuickCategoryPayload({ storeId: 'store-1', name: ' Dessert ', sortOrder: 4, timestamp }), {
  storeId: 'store-1',
  name: 'Dessert',
  sortOrder: 4,
  autoTagMode: false,
  autoTags: [],
  isActive: true,
  createdAt: timestamp,
  updatedAt: timestamp,
})

assert.deepEqual(buildCategoryPayload({
  storeId: 'store-1',
  name: ' Drink ',
  group: 'drink',
  autoTagMode: true,
  tagsInput: 'beer, wine',
  sortOrder: 2,
  timestamp,
}), {
  storeId: 'store-1',
  name: 'Drink',
  group: 'drink',
  sortOrder: 2,
  autoTagMode: true,
  autoTags: ['beer', 'wine'],
  isActive: true,
  createdAt: timestamp,
  updatedAt: timestamp,
})

assert.deepEqual(buildCategoryUpdatePayload({
  name: ' Food ',
  group: 'food',
  autoTagMode: false,
  tagsInput: 'main',
  timestamp,
}), {
  name: 'Food',
  group: 'food',
  autoTagMode: false,
  autoTags: ['main'],
  updatedAt: timestamp,
})

console.log('product form checks passed')
