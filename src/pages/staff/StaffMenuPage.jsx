import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import OptionModal from '../../components/OptionModal'
import StaffBottomNav from '../../components/StaffBottomNav'
import StaffMenuCategoryTabs from '../../components/staff/StaffMenuCategoryTabs'
import StaffMenuHeader from '../../components/staff/StaffMenuHeader'
import StaffMenuProductList from '../../components/staff/StaffMenuProductList'
import StaffMenuSubmitBar from '../../components/staff/StaffMenuSubmitBar'
import StaffOrderCompleteScreen from '../../components/staff/StaffOrderCompleteScreen'
import { useStore } from '../../contexts/StoreContext'
import useNow from '../../hooks/useNow'
import { createCartItemId } from '../../lib/cartItemId'
import { getDiscountedProductPrice } from '../../lib/discounts'
import { sortSoldOutProductsLast } from '../../lib/menuProductOrder'
import { describeUnavailableItems, formatOrderCommandError, logOrderCommandError } from '../../lib/orderCommandErrors'
import { createOrderCommandRequestId } from '../../lib/orderCommands'
import { productMatchesCategory } from '../../lib/menuCategory'
import { formatElapsed } from '../../lib/staffTableList'
import { useStaffMember } from '../../contexts/StaffMemberContext'
import { loadCustomerMenuData } from '../../services/customerMenuService'
import { submitStaffMenuOrder } from '../../services/staffMenuService'
import { subscribeStaffTable } from '../../services/staffTableService'

// スタッフの注文追加（2026-10-28 注文の流れ 第2章で作り直し）。写真なし・1行を低くして多く見せ、名前で探せる。
// 席と注文は画面の移動のときの値ではなく席の記録から読むので、画面を読み込み直しても送れる。
export default function StaffMenuPage() {
  const { tableId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { activeStaff } = useStaffMember()
  const { storeId: currentStoreId } = useStore()
  const now = useNow()
  const [table, setTable] = useState(null)
  const [tableLoaded, setTableLoaded] = useState(false)
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [activeCat, setActiveCat] = useState(null)
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [optionTarget, setOptionTarget] = useState(null)
  const submittingRef = useRef(false)
  const submitRequestIdRef = useRef(null)

  // この画面で注文を足す相手の注文は、開いたときの注文に固定する（会計後に次のお客様が座っても、前のお客様の分を付け替えない）。
  const lockedOrderIdRef = useRef(location.state?.orderId ?? null)
  if (!lockedOrderIdRef.current && table?.currentOrderId) lockedOrderIdRef.current = table.currentOrderId
  const orderId = lockedOrderIdRef.current
  const storeId = table?.storeId ?? location.state?.storeId ?? currentStoreId
  const guestCount = table?.guestCount ?? location.state?.guestCount ?? 0

  useEffect(() => {
    if (!tableId) return undefined
    return subscribeStaffTable(tableId, nextTable => {
      setTable(nextTable)
      setTableLoaded(true)
    })
  }, [tableId])

  // 店が決まらない（席が無いなど）ときは、読み込み中のまま止めない。
  useEffect(() => {
    if (tableLoaded && !storeId) setLoading(false)
  }, [tableLoaded, storeId])

  async function loadMenu() {
    if (!storeId) return
    setLoadError('')
    try {
      const data = await loadCustomerMenuData(storeId)
      setCategories(data.categories)
      setProducts(data.products)
      setActiveCat(current => data.categories.some(category => category.id === current)
        ? current
        : data.categories[0]?.id ?? null)
    } catch {
      setLoadError('メニューを読み込めませんでした。通信を確かめて、もう一度お試しください')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMenu()
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

      return [...prev, { id: createCartItemId(product.id), product, quantity: addQuantity, optionSelections }]
    })
  }

  function handleAddProduct(product) {
    if (product.isSoldOut) return
    if ((product.options ?? []).length > 0) {
      setOptionTarget(product)
      return
    }

    addToCart(product, [])
  }

  function handleOptionConfirm(optionSelections, quantity = 1) {
    const product = optionTarget
    if (Array.isArray(optionSelections) && optionSelections.every(item => Array.isArray(item?.optionSelections))) {
      optionSelections.forEach(item => addToCart(product, item.optionSelections, item.quantity))
    } else {
      addToCart(product, optionSelections, quantity)
    }
    setOptionTarget(null)
  }

  function updateQty(cartItemId, qty) {
    if (qty <= 0) {
      setCart(prev => prev.filter(item => item.id !== cartItemId))
      return
    }
    setCart(prev => prev.map(item => item.id === cartItemId ? { ...item, quantity: qty } : item))
  }

  async function handleSubmit() {
    if (submittingRef.current || cart.length === 0 || !orderId) return
    submittingRef.current = true
    if (!submitRequestIdRef.current) {
      submitRequestIdRef.current = createOrderCommandRequestId('staff-order')
    }
    setSubmitting(true)
    setSubmitError('')
    try {
      await submitStaffMenuOrder({
        cart,
        orderId,
        storeId,
        tableId,
        activeStaff,
        clientRequestId: submitRequestIdRef.current,
      })
      setCart([])
      submitRequestIdRef.current = null
      setSubmitted(true)
    } catch (error) {
      const formatted = formatOrderCommandError(error, { context: 'staffSubmit' })
      const unavailable = describeUnavailableItems(error)
      if (unavailable) {
        // 何も書かれていないので、残りの品は新しい送信として送り直せるようにする。
        const ids = new Set(unavailable.productIds)
        setCart(prev => prev.filter(item => !ids.has(item.product.id)))
        submitRequestIdRef.current = null
        // メニューを読み直して、売り切れを画面にも出す。
        loadCustomerMenuData(storeId).then(data => setProducts(data.products)).catch(() => {})
      }
      setSubmitError(unavailable?.message ?? formatted.message)
      logOrderCommandError({
        operation: 'staff_submit_order',
        error,
        metadata: { storeId, tableId, orderId, itemCount: cart.length },
      })
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const cartTotal = cart.reduce((sum, item) => {
    const extra = (item.optionSelections ?? []).reduce((extraSum, option) => extraSum + (option.extraPrice ?? 0), 0)
    const { discountedPrice } = getDiscountedProductPrice(item.product)
    return sum + (discountedPrice + extra) * item.quantity
  }, 0)
  const keyword = search.trim()
  const activeCategory = categories.find(category => category.id === activeCat)
  // 名前で探すときは、分類をまたいで探す。
  const filteredProducts = sortSoldOutProductsLast(keyword
    ? products.filter(product => String(product.name ?? '').includes(keyword))
    : activeCategory
      ? products.filter(product => productMatchesCategory(product, activeCategory))
      : products)
  const elapsed = table?.startedAt?.seconds ? formatElapsed(table.startedAt.seconds, now) : ''
  const tableMissing = tableLoaded && !table
  const orderClosed = tableLoaded && !tableMissing && (!orderId || table.currentOrderId !== orderId)
  const orderNotice = tableMissing
    ? '席が見つかりません。席一覧から開き直してください。'
    : !orderId
      ? 'この席の注文は終わっています。席へ戻って確かめてください。'
      : 'この席の注文が変わりました（会計が終わったなど）。席へ戻って確かめてください。'

  if (loading) return <div className="staff-menu__loading">読み込み中...</div>

  if (submitted) {
    return <StaffOrderCompleteScreen onBackToTable={() => navigate(`/staff/table/${tableId}`, { replace: true })} />
  }

  return (
    <div className={`staff-menu${cartCount > 0 ? ' has-cart' : ''}`}>
      {optionTarget && (
        <OptionModal
          product={optionTarget}
          onConfirm={handleOptionConfirm}
          onClose={() => setOptionTarget(null)}
        />
      )}

      <StaffMenuHeader
        tableName={table?.tableName ?? ''}
        guestCount={guestCount}
        elapsed={elapsed}
        onBack={() => navigate(`/staff/table/${tableId}`)}
      />
      <div className="staff-menu__search">
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="商品名で探す" aria-label="商品名で探す" />
      </div>
      {!keyword && (
        <StaffMenuCategoryTabs
          categories={categories}
          activeCategoryId={activeCat}
          onSelect={setActiveCat}
        />
      )}
      <div className="staff-menu__scroll">
        {(tableMissing || orderClosed) && <p className="staff-menu__notice" role="alert">{orderNotice}</p>}
        {loadError ? (
          <div className="staff-menu__notice" role="alert">
            {loadError}
            <button type="button" onClick={loadMenu}>もう一度読み込む</button>
          </div>
        ) : (
          <StaffMenuProductList
            products={filteredProducts}
            cart={cart}
            onAddProduct={handleAddProduct}
            onUpdateQuantity={updateQty}
          />
        )}
        {keyword && filteredProducts.length === 0 && <p className="staff-menu__empty">「{keyword}」の商品はありません</p>}
      </div>
      <StaffMenuSubmitBar
        cartCount={cartCount}
        cartTotal={cartTotal}
        errorMessage={submitError}
        submitting={submitting}
        disabled={tableMissing || orderClosed}
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
