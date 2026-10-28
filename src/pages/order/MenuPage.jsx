import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import CustomerCategoryTabs from '../../components/order/CustomerCategoryTabs'
import CustomerMenuHeader from '../../components/order/CustomerMenuHeader'
import CustomerMenuProductList from '../../components/order/CustomerMenuProductList'
import CartSheet from '../../components/order/CartSheet'
import ProductPhotoZoom from '../../components/order/ProductPhotoZoom'
import CustomerBottomNav from '../../components/CustomerBottomNav'
import OptionModal from '../../components/OptionModal'
import { useCart } from '../../contexts/CartContext'
import { useOrder } from '../../contexts/OrderContext'
import useCustomerCall from '../../hooks/useCustomerCall'
import { loadCustomerSubmitRecovery } from '../../lib/customerSubmitRecovery'
import { sortSoldOutProductsLast } from '../../lib/menuProductOrder'
import { productMatchesCategory } from '../../lib/menuCategory'
import { loadCustomerMenuData } from '../../services/customerMenuService'

// お客様のメニュー（2026-10-28 注文の流れ 第2章）。品はその場で数を増減し、カートに入ると下に青い帯が出る。
// カートはメニューの上のシートで開く（別の画面に移らない）。
export default function MenuPage() {
  const { orderId, storeId, tableId, table, storeConfig, storeConfigLoading } = useOrder()
  const { items, addItem, updateQuantity, count } = useCart()
  const { callDisabled, requestStaff } = useCustomerCall()
  const location = useLocation()
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [activeCat, setActiveCat] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [optionTarget, setOptionTarget] = useState(null)
  const [zoomTarget, setZoomTarget] = useState(null)
  const [cartSheet, setCartSheet] = useState(null)

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

  // 送った注文の確かめが済んでいないときは、カートより先に完了画面で確かめる（二重注文を防ぐ）。
  function openCart(notice = '') {
    const pendingSubmit = loadCustomerSubmitRecovery({ orderId, storeId, tableId })
    if (pendingSubmit) {
      navigate('../complete', {
        replace: true,
        state: {
          recoveringPendingSubmit: true,
          clientRequestId: pendingSubmit.clientRequestId,
          submittedItemCount: pendingSubmit.submittedItemCount,
        },
      })
      return
    }
    setCartSheet({ notice })
  }

  // 完了画面や以前の「/cart」から「カートを開いて」と来たとき（売り切れの知らせを引き継ぐ）。
  useEffect(() => {
    if (!location.state?.openCart) return
    const notice = location.state.submitNotice ?? ''
    navigate('.', { replace: true, state: null })
    openCart(notice)
  }, [location.state])

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
    <div className={`customer-menu${count > 0 ? ' has-cart' : ''}`}>
      {optionTarget && (
        <OptionModal
          product={optionTarget}
          onConfirm={handleOptionConfirm}
          onClose={() => setOptionTarget(null)}
        />
      )}
      {zoomTarget && (
        <ProductPhotoZoom
          product={zoomTarget}
          disabled={storeConfigLoading}
          onAdd={quantity => {
            addItem(zoomTarget, [], quantity)
            setZoomTarget(null)
          }}
          onSelectOptions={() => {
            setOptionTarget(zoomTarget)
            setZoomTarget(null)
          }}
          onClose={() => setZoomTarget(null)}
        />
      )}
      {cartSheet && <CartSheet initialNotice={cartSheet.notice} onClose={() => setCartSheet(null)} />}

      <CustomerMenuHeader
        tableName={table.tableName}
        onCall={requestStaff}
        callDisabled={callDisabled}
      />
      {!loading && !loadError && (
        <CustomerCategoryTabs
          categories={categories}
          activeCategoryId={activeCat}
          onSelect={setActiveCat}
        />
      )}
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
          <CustomerMenuProductList
            products={filteredProducts}
            cartItems={items}
            interactionDisabled={storeConfigLoading}
            customerMenuTapToAddEnabled={storeConfig.customerMenuTapToAddEnabled !== false}
            onAddProduct={handleAddProduct}
            onSetSimpleProductQuantity={setSimpleProductQuantity}
            onUpdateQuantity={updateQuantity}
            onZoomPhoto={setZoomTarget}
          />
        )}
      </div>

      {count > 0 && (
        <button type="button" className="customer-cart-bar" onClick={() => openCart()}>
          <span className="customer-cart-bar__count">{count}点</span>
          <span className="customer-cart-bar__label">カートを見て注文する</span>
          <span aria-hidden="true">›</span>
        </button>
      )}
      <CustomerBottomNav current="menu" />
    </div>
  )
}
