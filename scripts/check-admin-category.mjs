import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildAdminCategoryActivePayload,
  buildAdminCategoryPayload,
  normalizeAdminCategoryName,
  sortAdminCategories,
} from '../src/lib/adminCategory.js'

const categoryCss = readFileSync(new URL('../src/styles/admin-product-category.css', import.meta.url), 'utf8')
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

function ruleHasDeclaration(css, selector, declarationPattern) {
  const rulePattern = /([^{}]+)\{([^{}]+)\}/g
  for (const [, selectorList, declarations] of css.matchAll(rulePattern)) {
    const selectors = selectorList.split(',').map(item => item.trim())
    if (selectors.includes(selector) && declarationPattern.test(declarations)) return true
  }
  return false
}

function assertHas16pxFontSize(selector) {
  assert.ok(
    ruleHasDeclaration(categoryCss, selector, /font-size:\s*16px\b/),
    `${selector} should keep 16px font-size to avoid iOS focus zoom`,
  )
}

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

assertHas16pxFontSize('.category-add-form .admin-text-input')
assertHas16pxFontSize('.category-group-select')
assertHas16pxFontSize('.category-edit-group-select')
assertHas16pxFontSize('.category-tags-input')
assertHas16pxFontSize('.category-edit-name-input')
assertHas16pxFontSize('.category-edit-tags-input')
assertHas16pxFontSize('.category-list-item.is-editing .category-auto-toggle-small')
assertHas16pxFontSize('.category-list-item.is-editing .category-row-action')
assertHas16pxFontSize('.category-list-item.is-editing .tag-template-name-input')
assertHas16pxFontSize('.category-list-item.is-editing .tag-template-save-button')
assert.ok(!/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i.test(indexHtml), 'viewport should not disable user zoom')

console.log('admin category checks passed')
