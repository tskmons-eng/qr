import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const component = await readFile('src/components/staff/StaffMenuProductList.jsx', 'utf8')
const page = await readFile('src/pages/staff/StaffMenuPage.jsx', 'utf8')
const styles = await readFile('src/styles/staff-menu.css', 'utf8')

assert.ok(component.includes('function QuantityControl'), 'staff menu should use a shared quantity control')
assert.ok(component.includes('const optionCartItems = cartItems.filter'), 'staff menu should separate option cart rows')
assert.ok(component.includes('staff-menu-product__option-row'), 'option cart rows should render as controlled rows')
assert.ok(component.includes('compact'), 'option cart rows should use compact quantity controls')
assert.ok(component.includes('onDecrease={() => onUpdateQuantity(cartItem.id, cartItem.quantity - 1)}'), 'option rows should support decrement')
assert.ok(component.includes('onIncrease={() => onUpdateQuantity(cartItem.id, cartItem.quantity + 1)}'), 'option rows should support increment')
assert.ok(!component.includes('{formatOptions(cartItem.optionSelections)} × {cartItem.quantity}'), 'option rows should not be display-only quantity text')

assert.ok(page.includes("import { createCartItemId } from '../../lib/cartItemId'"), 'staff menu should use the shared cart item id helper')
assert.ok(page.includes('id: createCartItemId(product.id)'), 'staff menu option rows should get unique cart ids')
assert.ok(!page.includes('id: `${product.id}_${Date.now()}`'), 'staff menu should not use same-millisecond cart ids')

assert.ok(styles.includes('.staff-menu-product__option-list'), 'staff menu should style option quantity rows')
assert.ok(styles.includes('.staff-menu-product__option-row'), 'staff menu should keep option label and quantity controls aligned')
assert.ok(styles.includes('grid-template-columns: minmax(0, 1fr) auto'), 'option row should preserve quantity control width')
assert.ok(styles.includes('overflow-wrap: anywhere'), 'long option labels should wrap without covering controls')

console.log('staff menu checks passed')
