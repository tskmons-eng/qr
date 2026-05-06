import { createContext, useContext, useState } from 'react'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [items, setItems] = useState([])

  function addItem(product, optionSelections = []) {
    setItems(prev => {
      if (optionSelections.length === 0) {
        const idx = prev.findIndex(i => i.product.id === product.id && i.optionSelections.length === 0)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 }
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
          next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 }
          return next
        }
      }
      return [...prev, { id: `${product.id}_${Date.now()}`, product, quantity: 1, optionSelections }]
    })
  }

  function updateQuantity(itemId, quantity) {
    if (quantity <= 0) {
      setItems(prev => prev.filter(i => i.id !== itemId))
    } else {
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity } : i))
    }
  }

  function clearCart() {
    setItems([])
  }

  const total = items.reduce((sum, i) => {
    const extra = (i.optionSelections ?? []).reduce((s, o) => s + (o.extraPrice ?? 0), 0)
    return sum + (i.product.price + extra) * i.quantity
  }, 0)
  const count = items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <CartContext.Provider value={{ items, addItem, updateQuantity, clearCart, total, count }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}
