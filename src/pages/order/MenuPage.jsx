import { useEffect, useState } from 'react'
import CustomerCategoryTabs from '../../components/order/CustomerCategoryTabs'
import CustomerMenuHeader from '../../components/order/CustomerMenuHeader'
import CustomerMenuProductList from '../../components/order/CustomerMenuProductList'
import CustomerBottomNav from '../../components/CustomerBottomNav'
import OptionModal from '../../components/OptionModal'
import { useCart } from '../../contexts/CartContext'
import { useOrder } from '../../contexts/OrderContext'
import useCustomerCall from '../../hooks/useCustomerCall'
import { sortSoldOutProductsLast } from '../../lib/menuProductOrder'
import { productMatchesCategory } from '../../lib/menuCategory'
import { loadCustomerMenuData } from '../../services/customerMenuService'

export default function MenuPage() {
  const { storeId, table, storeConfig, storeConfigLoading } = useOrder()
  const { items, addItem, updateQuantity } = useCart()
  const { callDisabled, requestStaff } = useCustomerCall()
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [activeCat, setActiveCat] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [optionTarget, setOptionTarget] = useState(null)

  useEffect(() => {
    if (!storeId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setLoadError('')
      try {
        const data = await loadCustomerMenuData(storeId)
        if (cancelled) return
        setCategories(data.categories)
        setProducts(data.products)
        setActiveCat(current => data.categories.some(category => category.id === current)
          ? current
          : data.categories[0]?.id ?? null)
      } catch {
        if (!cancelled) setLoadError('メニューを読み込めませんでした。通信を確認して、もう一度お試しください。')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [storeId])

  function handleAddProduct(product) {
    if (product.isSoldOut) return
    if ((product.options ?? []).length > 0) {
      setOptionTarget(product)
      return
    }

    addItem(product, [])
  }

  function handleOptionConfirm(optionSelections, quantity = 1) {
    const product = optionTarget
    if (Array.isArray(optionSelections) && optionSelections.every(item => Array.isArray(item?.optionSelections))) {
      optionSelections.forEach(item => addItem(product, item.optionSelections, item.quantity))
    } else {
      addItem(product, optionSelections, quantity)
    }
    setOptionTarget(null)
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
  const filteredProducts = sortSoldOutProductsLast(activeCategory
    ? products.filter(product => productMatchesCategory(product, activeCategory))
    : products)

  return (
    <div className="customer-menu">
      {optionTarget && (
        <OptionModal
          product={optionTarget}
          onConfirm={handleOptionConfirm}
          onClose={() => setOptionTarget(null)}
        />
      )}

      <CustomerMenuHeader
        tableName={table.tableName}
        onCall={requestStaff}
        callDisabled={callDisabled}
      />
      <div className="customer-menu__scroll">
        {loading ? (
          <div className="customer-menu__skeleton" role="status" aria-label="メニューを読み込み中">
            <span /><span /><span /><span />
          </div>
        ) : loadError ? (
          <div className="customer-menu__error" role="alert">
            <p>{loadError}</p>
            <button type="button" onClick={() => window.location.reload()}>再読み込み</button>
          </div>
        ) : (
          <>
            <CustomerCategoryTabs
              categories={categories}
              activeCategoryId={activeCat}
              onSelect={setActiveCat}
            />
            <CustomerMenuProductList
              products={filteredProducts}
              cartItems={items}
              interactionDisabled={storeConfigLoading}
              customerMenuTapToAddEnabled={storeConfig.customerMenuTapToAddEnabled !== false}
              onAddProduct={handleAddProduct}
              onSetSimpleProductQuantity={setSimpleProductQuantity}
              onUpdateQuantity={updateQuantity}
            />
          </>
        )}
      </div>

      <CustomerBottomNav current="menu" />
    </div>
  )
}
