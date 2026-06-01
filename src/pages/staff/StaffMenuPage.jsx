import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import OptionModal from '../../components/OptionModal'
import StaffBottomNav from '../../components/StaffBottomNav'
import SuggestionSheet from '../../components/SuggestionSheet'
import StaffMenuCategoryTabs from '../../components/staff/StaffMenuCategoryTabs'
import StaffMenuHeader from '../../components/staff/StaffMenuHeader'
import StaffMenuProductList from '../../components/staff/StaffMenuProductList'
import StaffMenuSubmitBar from '../../components/staff/StaffMenuSubmitBar'
import { getDiscountedProductPrice } from '../../lib/discounts'
import { productMatchesCategory } from '../../lib/productTags'
import { loadCustomerMenuData } from '../../services/customerMenuService'
import { submitStaffMenuOrder } from '../../services/staffMenuService'

export default function StaffMenuPage() {
  const { tableId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { orderId, storeId, guestCount } = location.state || {}
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [activeCat, setActiveCat] = useState(null)
  const [cart, setCart] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [optionTarget, setOptionTarget] = useState(null)
  const [suggestions, setSuggestions] = useState([])

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

  function addToCart(product, optionSelections = [], quantity = 1) {
    const addQuantity = Math.max(1, parseInt(quantity, 10) || 1)
    setCart(prev => {
      const selectionKey = JSON.stringify((optionSelections ?? []).map(option => `${option.groupName}:${option.choice}`).sort())
      const existingIndex = prev.findIndex(item => (
        item.product.id === product.id &&
        JSON.stringify(item.optionSelections.map(option => `${option.groupName}:${option.choice}`).sort()) === selectionKey
      ))

      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = { ...next[existingIndex], quantity: next[existingIndex].quantity + addQuantity }
        return next
      }

      return [...prev, { id: `${product.id}_${Date.now()}`, product, quantity: addQuantity, optionSelections }]
    })
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

    addToCart(product, [])
    showSuggestionsFor(product)
  }

  function handleOptionConfirm(optionSelections, quantity = 1) {
    const product = optionTarget
    if (Array.isArray(optionSelections) && optionSelections.every(item => Array.isArray(item?.optionSelections))) {
      optionSelections.forEach(item => addToCart(product, item.optionSelections, item.quantity))
    } else {
      addToCart(product, optionSelections, quantity)
    }
    setOptionTarget(null)
    showSuggestionsFor(product)
  }

  function handleSuggestionAdd(product) {
    handleAddProduct(product)
    setSuggestions([])
  }

  function updateQty(cartItemId, qty) {
    if (qty <= 0) {
      setCart(prev => prev.filter(item => item.id !== cartItemId))
      return
    }
    setCart(prev => prev.map(item => item.id === cartItemId ? { ...item, quantity: qty } : item))
  }

  async function handleSubmit() {
    if (cart.length === 0 || !orderId) return
    setSubmitting(true)
    try {
      await submitStaffMenuOrder({ cart, orderId, storeId, tableId })
      navigate(`/staff/table/${tableId}`, { replace: true })
    } catch {
      alert('送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const cartTotal = cart.reduce((sum, item) => {
    const extra = (item.optionSelections ?? []).reduce((extraSum, option) => extraSum + (option.extraPrice ?? 0), 0)
    const { discountedPrice } = getDiscountedProductPrice(item.product)
    return sum + (discountedPrice + extra) * item.quantity
  }, 0)
  const activeCategory = categories.find(category => category.id === activeCat)
  const filteredProducts = activeCategory
    ? products.filter(product => productMatchesCategory(product, activeCategory))
    : products

  if (loading) return <div className="staff-menu__loading">読み込み中...</div>

  return (
    <div className={`staff-menu${cartCount > 0 ? ' has-cart' : ''}`}>
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

      <StaffMenuHeader onBack={() => navigate(-1)} />
      <StaffMenuCategoryTabs
        categories={categories}
        activeCategoryId={activeCat}
        onSelect={setActiveCat}
      />
      <StaffMenuProductList
        products={filteredProducts}
        cart={cart}
        onAddProduct={handleAddProduct}
        onUpdateQuantity={updateQty}
      />
      <StaffMenuSubmitBar
        cartCount={cartCount}
        cartTotal={cartTotal}
        submitting={submitting}
        onSubmit={handleSubmit}
      />
      <StaffBottomNav
        current="seat"
        tableId={tableId}
        orderId={orderId}
        storeId={storeId}
        guestCount={guestCount}
      />
    </div>
  )
}
