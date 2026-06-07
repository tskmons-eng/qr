import { useEffect, useRef, useState } from 'react'
import CustomerCategoryTabs from '../../components/order/CustomerCategoryTabs'
import CustomerMenuHeader from '../../components/order/CustomerMenuHeader'
import CustomerMenuProductList from '../../components/order/CustomerMenuProductList'
import CustomerBottomNav from '../../components/CustomerBottomNav'
import OptionModal from '../../components/OptionModal'
import SuggestionSheet from '../../components/SuggestionSheet'
import { useCart } from '../../contexts/CartContext'
import { useOrder } from '../../contexts/OrderContext'
import { productMatchesCategory } from '../../lib/productTags'
import { createCustomerCall, loadCustomerMenuData } from '../../services/customerMenuService'

export default function MenuPage() {
  const { storeId, tableId, orderId, table } = useOrder()
  const { items, addItem, updateQuantity } = useCart()
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [activeCat, setActiveCat] = useState(null)
  const [loading, setLoading] = useState(true)
  const [callSent, setCallSent] = useState(false)
  const [checkoutSent, setCheckoutSent] = useState(false)
  const [optionTarget, setOptionTarget] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const cooldownRef = useRef(null)

  useEffect(() => () => clearTimeout(cooldownRef.current), [])

  useEffect(() => {
    if (!storeId) return

    async function load() {
      const data = await loadCustomerMenuData(storeId)
      setCategories(data.categories)
      setProducts(data.products)
      if (data.categories.length > 0) setActiveCat(data.categories[0].id)
      setLoading(false)
    }

    load()
  }, [storeId])

  async function sendCall(type) {
    await createCustomerCall({
      storeId,
      tableId,
      tableName: table.tableName,
      orderId,
      type,
    })
  }

  async function handleCall() {
    if (callSent) return
    await sendCall('call')
    setCallSent(true)
    cooldownRef.current = setTimeout(() => setCallSent(false), 30000)
  }

  async function handleCheckout() {
    if (checkoutSent) return
    await sendCall('checkout')
    setCheckoutSent(true)
  }

  function showSuggestionsFor(product) {
    const ids = product.linkedProductIds ?? []
    if (ids.length === 0) return
    const linked = products.filter(candidate => ids.includes(candidate.id))
    if (linked.length > 0) setSuggestions(linked)
  }

  function handleAddProduct(product) {
    if (product.isSoldOut) return
    if ((product.options ?? []).length > 0) {
      setOptionTarget(product)
      return
    }

    addItem(product, [])
    showSuggestionsFor(product)
  }

  function handleOptionConfirm(optionSelections, quantity = 1) {
    const product = optionTarget
    if (Array.isArray(optionSelections) && optionSelections.every(item => Array.isArray(item?.optionSelections))) {
      optionSelections.forEach(item => addItem(product, item.optionSelections, item.quantity))
    } else {
      addItem(product, optionSelections, quantity)
    }
    setOptionTarget(null)
    showSuggestionsFor(product)
  }

  function handleSuggestionAdd(product) {
    handleAddProduct(product)
    setSuggestions([])
  }

  function setSimpleProductQuantity(product, value) {
    const nextQuantity = Math.min(99, Math.max(0, parseInt(value, 10) || 0))
    const item = items.find(cartItem => cartItem.product.id === product.id && cartItem.optionSelections.length === 0)
    if (item) {
      updateQuantity(item.id, nextQuantity)
    } else if (nextQuantity > 0) {
      addItem(product, [], nextQuantity)
    }
  }

  const activeCategory = categories.find(category => category.id === activeCat)
  const filteredProducts = activeCategory
    ? products.filter(product => productMatchesCategory(product, activeCategory))
    : products

  if (loading) return <div className="customer-menu__loading">読み込み中...</div>

  return (
    <div className="customer-menu">
      {optionTarget && (
        <OptionModal
          product={optionTarget}
          onConfirm={handleOptionConfirm}
          onClose={() => setOptionTarget(null)}
        />
      )}
      {suggestions.length > 0 && !optionTarget && (
        <SuggestionSheet
          suggestions={suggestions}
          onAdd={handleSuggestionAdd}
          onClose={() => setSuggestions([])}
        />
      )}

      <CustomerMenuHeader tableName={table.tableName} />
      <CustomerCategoryTabs
        categories={categories}
        activeCategoryId={activeCat}
        onSelect={setActiveCat}
      />
      <CustomerMenuProductList
        products={filteredProducts}
        cartItems={items}
        onAddProduct={handleAddProduct}
        onSetSimpleProductQuantity={setSimpleProductQuantity}
      />

      <CustomerBottomNav
        current="menu"
        onCall={handleCall}
        callDisabled={callSent}
        onCheckout={handleCheckout}
        checkoutDisabled={checkoutSent}
      />
    </div>
  )
}
