import { createContext, useContext, useEffect, useState } from 'react'
import { createCartItemId } from '../lib/cartItemId'
import { loadSavedCart, saveCart } from '../lib/customerCart'
import { getDiscountedProductPrice } from '../lib/discounts'

const CartContext = createContext(null)

// storageKey があると、カートを端末に控える（画面を閉じたり読み込み直したりしても消えない。2026-10-28 注文の流れ 第2章）。
// 席の注文ごとに別の控えにするので、会計が終わって次のお客様が来ても前のカートは出ない。
// 注文が変わったときは、使う側が key を変えて作り直す（OrderEntryPage）。
const MAX_ITEM_QUANTITY = 99

export function CartProvider({ children, storageKey = '' }) {
  const [items, setItems] = useState(() => (storageKey ? loadSavedCart(storageKey) : []))

  useEffect(() => {
    if (storageKey) saveCart(storageKey, items)
  }, [storageKey, items])

  function addItem(product, optionSelections = [], quantity = 1) {
    const addQuantity = Math.max(1, parseInt(quantity, 10) || 1)
    setItems(prev => {
      if (optionSelections.length === 0) {
        const idx = prev.findIndex(i => i.product.id === product.id && i.optionSelections.length === 0)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx], quantity: Math.min(MAX_ITEM_QUANTITY, next[idx].quantity + addQuantity) }
          return next
        }
      } else {
        const selKey = JSON.stringify(optionSelections.map(o => `${o.groupName}:${o.choice}`).sort())
        const idx = prev.findIndex(i =>
          i.product.id === product.id &&
          JSON.stringify(i.optionSelections.map(o => `${o.groupName}:${o.choice}`).sort()) === selKey
        )
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx], quantity: Math.min(MAX_ITEM_QUANTITY, next[idx].quantity + addQuantity) }
          return next
        }
      }
      return [...prev, { id: createCartItemId(product.id), product, quantity: Math.min(MAX_ITEM_QUANTITY, addQuantity), optionSelections }]
    })
  }

  function updateQuantity(itemId, quantity) {
    if (quantity <= 0) {
      setItems(prev => prev.filter(i => i.id !== itemId))
    } else {
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity: Math.min(MAX_ITEM_QUANTITY, quantity) } : i))
    }
  }

  function clearCart() {
    setItems([])
  }

  // 送り直しで止まった品を除いて、送ろうとした品をカートへ戻す（完了画面から）。そのあとに入れた品は残す。
  function restoreCartItems(restoredItems) {
    if (!Array.isArray(restoredItems) || restoredItems.length === 0) return
    setItems(prev => [...restoredItems, ...prev.filter(item => !restoredItems.some(restored => restored.id === item.id))])
  }

  // サーバーが注文を止めた品（売り切れになったなど）をカートから外す。
  function removeProducts(productIds) {
    const ids = new Set(productIds)
    setItems(prev => prev.filter(i => !ids.has(i.product.id)))
  }

  const total = items.reduce((sum, i) => {
    const extra = (i.optionSelections ?? []).reduce((s, o) => s + (o.extraPrice ?? 0), 0)
    const { discountedPrice } = getDiscountedProductPrice(i.product)
    return sum + (discountedPrice + extra) * i.quantity
  }, 0)
  const count = items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <CartContext.Provider value={{ items, addItem, updateQuantity, clearCart, restoreCartItems, removeProducts, total, count }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}
