import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  CATEGORY_GROUPS,
  buildCategoryPayload,
  buildCategoryUpdatePayload,
  buildNewProductPayload,
  buildProductUpdatePayload,
  cleanDiscountConfig,
  cleanOptionGroups,
  describeDiscount,
  discountLabel,
  nextSortOrder,
  normalizeChoices,
  normalizeDiscountConfig,
  productFormFromProduct,
  validateProductForm,
} from '../src/lib/productForm.js'
import { productMatchesCategory } from '../src/lib/menuCategory.js'

// 2026-10-23 商品設計：使われていない機能（タグ・タグセット・オプションのテンプレート・追加表示の分類・関連商品・自動タグ）を無くした。

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
  enabled: true, type: 'amount', value: '20', startDate: '', endDate: '', weekdays: [],
})
assert.deepEqual(cleanDiscountConfig({ enabled: true, type: 'percent', value: '15', weekdays: [1, 5] }), {
  enabled: true, type: 'percent', value: 15, startDate: '', endDate: '', weekdays: [1, 5],
})
assert.equal(discountLabel({ enabled: true, type: 'amount', value: 300 }), '300円引き')
assert.equal(discountLabel({ enabled: true, type: 'percent', value: 10 }), '10%引き')
assert.equal(describeDiscount({ enabled: true, type: 'amount', value: 100, startDate: '2026-09-19', endDate: '2026-09-23', weekdays: [] }), '100円引き・9月19日〜9月23日・毎日')
assert.equal(describeDiscount({ enabled: true, type: 'amount', value: 100, startDate: '', endDate: '', weekdays: [0, 6] }), '100円引き・ずっと・日・土')

assert.equal(validateProductForm({ name: '', price: '100', categoryId: 'c' }), '商品名を入れてください')
assert.equal(validateProductForm({ name: 'A', price: '1,000', categoryId: 'c' }), '値段は数字で入れてください')
assert.equal(validateProductForm({ name: 'A', price: '100', categoryId: '' }), '分類を選んでください')
assert.equal(validateProductForm({ name: 'A', price: '0', categoryId: 'c' }), '')
// 選ぶものが中途半端なら止める（黙って捨てると「必ず選ぶ」が効かなくなる）。空のものだけは捨ててよい。
assert.equal(validateProductForm({ name: 'A', price: '1', categoryId: 'c', options: [{ groupName: '味', choices: [] }] }), '「味」の選択肢を入れて「足す」を押してください')
assert.equal(validateProductForm({ name: 'A', price: '1', categoryId: 'c', options: [{ groupName: ' ', choices: [{ label: '塩' }] }] }), '選ぶものの名前（例：味）を入れてください')
assert.equal(validateProductForm({ name: 'A', price: '1', categoryId: 'c', options: [{ groupName: '', choices: [] }, { groupName: '味', choices: ['塩'] }] }), '')

assert.equal(nextSortOrder([]), 0)
assert.equal(nextSortOrder([{ sortOrder: 3 }, { sortOrder: 9 }, { sortOrder: 1 }]), 10, 'deleted gaps never collide')

const timestamp = { mock: 'serverTimestamp' }
const form = {
  name: ' Lunch Set ',
  price: '1200',
  categoryId: 'cat-main',
  isVisible: true,
  isSoldOut: false,
  options: [{ groupName: ' Drink ', choices: [{ label: ' Coffee ', extraPrice: '100' }] }],
  discountConfig: { enabled: true, type: 'amount', value: '100' },
}

assert.deepEqual(buildNewProductPayload({ storeId: 'store-1', form, sortOrder: 3, timestamp }), {
  storeId: 'store-1', name: 'Lunch Set', price: 1200, categoryId: 'cat-main', isVisible: true, isSoldOut: false, sortOrder: 3, createdAt: timestamp, updatedAt: timestamp,
})
// 保存では、無くした機能の項目（tags・displayCategoryIds・linkedProductIds）を書かない。
assert.deepEqual(buildProductUpdatePayload({ form, imageUrl: 'https://example.test/image.jpg', timestamp }), {
  name: 'Lunch Set',
  price: 1200,
  categoryId: 'cat-main',
  isVisible: true,
  isSoldOut: false,
  options: [{ groupName: 'Drink', required: true, choices: [{ label: 'Coffee', extraPrice: 100 }] }],
  discountConfig: { enabled: true, type: 'amount', value: 100, startDate: '', endDate: '', weekdays: [] },
  imageUrl: 'https://example.test/image.jpg',
  updatedAt: timestamp,
})

assert.deepEqual(productFormFromProduct({ name: 'A', price: 300, categoryId: 'c', options: [{ groupName: 'G', choices: ['x'] }], tags: ['old'] }), {
  name: 'A', price: '300', categoryId: 'c', isVisible: true, isSoldOut: false,
  options: [{ groupName: 'G', choices: [{ label: 'x', extraPrice: 0 }] }],
  discountConfig: { enabled: false, type: 'amount', value: '', startDate: '', endDate: '', weekdays: [] },
})

assert.deepEqual(buildCategoryPayload({ storeId: 'store-1', name: ' Drink ', group: 'drink', sortOrder: 2, timestamp }), {
  storeId: 'store-1', name: 'Drink', group: 'drink', sortOrder: 2, isActive: true, createdAt: timestamp, updatedAt: timestamp,
})
assert.deepEqual(buildCategoryUpdatePayload({ name: ' Food ', group: 'food', isActive: false, timestamp }), {
  name: 'Food', group: 'food', isActive: false, updatedAt: timestamp,
})
// 厨房の分け方の値は今までと同じ（food / drink / 空＝その他）。
assert.deepEqual(CATEGORY_GROUPS.map(group => group.key), ['food', 'drink', ''])

// 分類に出るのは、その分類の商品だけ（追加表示・自動タグは無くした）。
assert.equal(productMatchesCategory({ categoryId: 'a' }, { id: 'a' }), true)
assert.equal(productMatchesCategory({ categoryId: 'a', displayCategoryIds: ['b'] }, { id: 'b', autoTagMode: true }), false)
assert.equal(productMatchesCategory({ categoryId: 'a' }, null), false)

// 注文画面は関連商品の提案を出さない。
for (const page of ['../src/pages/order/MenuPage.jsx', '../src/pages/staff/StaffMenuPage.jsx']) {
  const source = readFileSync(new URL(page, import.meta.url), 'utf8')
  assert.doesNotMatch(source, /SuggestionSheet|linkedProductIds|productTags/)
  assert.match(source, /from '\.\.\/\.\.\/lib\/menuCategory'/)
}

console.log('product form checks passed')
