import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

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

// カテゴリー管理は商品画面のカテゴリータブだけ（旧 /admin/categories は 2026-10-21 に削除）。
// 2026-10-22 整理 第3章：管理画面はスタッフ画面に一本化。古い /admin/products・/admin/categories はメニュー管理へ案内する。
const authenticatedApp = readFileSync(new URL('../src/AuthenticatedApp.jsx', import.meta.url), 'utf8')
assert.doesNotMatch(authenticatedApp, /CategoryPage/, 'old category page should stay removed')
assert.match(authenticatedApp, /products: '\/staff\/menu-admin'/)
assert.match(authenticatedApp, /categories: '\/staff\/menu-admin'/)

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
