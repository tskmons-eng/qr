import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

const appSource = read('../src/App.jsx')
const authenticatedAppSource = read('../src/AuthenticatedApp.jsx')
const orderEntrySource = read('../src/pages/order/OrderEntryPage.jsx')
const productListSource = read('../src/components/order/CustomerMenuProductList.jsx')
const indexStyles = read('../src/index.css')
const customerStyles = read('../src/styles/customer.css')
const authenticatedStyles = read('../src/styles/authenticated.css')
const viteConfig = read('../vite.config.js')

assert.match(appSource, /const OrderEntryPage = lazy\(\(\) => import\('\.\/pages\/order\/OrderEntryPage'\)\)/)
assert.match(appSource, /const AuthenticatedApp = lazy\(\(\) => import\('\.\/AuthenticatedApp'\)\)/)
assert.doesNotMatch(appSource, /AuthProvider|StoreProvider|AdminLayout|StaffLayout|KitchenPage|jspdf|heic2any/)

assert.match(authenticatedAppSource, /AuthProvider/)
assert.match(authenticatedAppSource, /StoreProvider/)
assert.match(authenticatedAppSource, /import '\.\/styles\/authenticated\.css'/)
assert.match(orderEntrySource, /import '\.\.\/\.\.\/styles\/customer\.css'/)
assert.match(orderEntrySource, /const GuestCountPage = lazy/)
assert.match(orderEntrySource, /const MenuPage = lazy/)
assert.match(orderEntrySource, /const CartPage = lazy/)
assert.match(orderEntrySource, /const OrderCompletePage = lazy/)

assert.doesNotMatch(indexStyles, /fonts\.googleapis\.com/)
assert.doesNotMatch(indexStyles, /admin\.css|staff-|customer-menu|customer-cart|customer-order-status/)
assert.match(customerStyles, /customer-entry\.css/)
assert.match(customerStyles, /customer-menu\.css/)
assert.match(customerStyles, /customer-cart\.css/)
assert.doesNotMatch(customerStyles, /admin|staff-/)
assert.match(authenticatedStyles, /admin\.css/)
assert.match(authenticatedStyles, /staff-shell\.css/)

assert.match(productListSource, /loading="lazy"/)
assert.match(productListSource, /decoding="async"/)
assert.doesNotMatch(viteConfig, /return 'vendor-jspdf'|return 'vendor-html2canvas'|return 'vendor-dompurify'|return 'vendor-canvg'/)

console.log('customer performance checks passed')
