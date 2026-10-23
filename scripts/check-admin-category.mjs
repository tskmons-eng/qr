import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// 2026-10-23 商品設計：分類はメニュー管理の見出しから直す（admin-menu.css）。入力欄は 16px（iPhone の拡大を防ぐ）。
const categoryCss = [
  '../src/styles/admin-menu.css',
  '../src/styles/admin-staff.css',
  '../src/styles/owner-dashboard.css',
].map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join(' ')
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

// カテゴリー管理はメニュー管理の見出しから（旧 /admin/categories は 2026-10-21 に削除、タブは 2026-10-23 に廃止）。
// 2026-10-22 整理 第3章：管理画面はスタッフ画面に一本化。古い /admin/products・/admin/categories はメニュー管理へ案内する。
const authenticatedApp = readFileSync(new URL('../src/AuthenticatedApp.jsx', import.meta.url), 'utf8')
assert.doesNotMatch(authenticatedApp, /CategoryPage/, 'old category page should stay removed')
assert.match(authenticatedApp, /products: '\/staff\/menu-admin'/)
assert.match(authenticatedApp, /categories: '\/staff\/menu-admin'/)

assertHas16pxFontSize('.menu-sheet__input')
assertHas16pxFontSize('.menu-admin__search')
assertHas16pxFontSize('.staff-sheet-form__field input')
assertHas16pxFontSize('.owner-store__inline input')
assertHas16pxFontSize('.owner-invite__field input')
assert.ok(!/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i.test(indexHtml), 'viewport should not disable user zoom')

console.log('admin category checks passed')
