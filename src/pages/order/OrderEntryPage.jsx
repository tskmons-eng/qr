import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import AppRouteLoading from '../../components/AppRouteLoading'
import OrderEntryStatus from '../../components/order/OrderEntryStatus'
import { CartProvider } from '../../contexts/CartContext'
import { OrderProvider } from '../../contexts/OrderContext'
import { cartStorageKey } from '../../lib/customerCart'
import { getCustomerEntryStartPath } from '../../lib/customerEntry'
import { STORE_CONFIG_DEFAULTS } from '../../lib/settingsConfig'
import { ensureCustomerOrderAccess, forgetCustomerJoined, isCustomerJoined, trySignInCustomer } from '../../services/customerAccessService'
import { loadCustomerStoreConfig, subscribeCustomerTableByQrToken } from '../../services/customerEntryService'
import '../../styles/customer.css'

const CartPage = lazy(() => import('./CartPage'))
const GuestCountPage = lazy(() => import('./GuestCountPage'))
const MenuPage = lazy(() => import('./MenuPage'))
const OrderCompletePage = lazy(() => import('./OrderCompletePage'))

export default function OrderEntryPage() {
  const { qrToken } = useParams()
  const [table, setTable] = useState(null)
  const [orderId, setOrderId] = useState(null)
  const [storeConfig, setStoreConfig] = useState(STORE_CONFIG_DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [configLoading, setConfigLoading] = useState(true)
  const [error, setError] = useState(null)
  const [accessOrderId, setAccessOrderId] = useState(null)
  const [accessError, setAccessError] = useState(false)
  const [accessRetry, setAccessRetry] = useState(0)
  const [sessionEnded, setSessionEnded] = useState(false)
  const seenOrderIdRef = useRef(null)
  const loadedConfigStoreIdRef = useRef(null)
  const configRequestIdRef = useRef(0)

  useEffect(() => {
    loadedConfigStoreIdRef.current = null
    configRequestIdRef.current += 1
    setTable(null)
    setOrderId(null)
    setStoreConfig(STORE_CONFIG_DEFAULTS)
    setLoading(true)
    setConfigLoading(true)
    setError(null)

    return subscribeCustomerTableByQrToken(qrToken, nextTable => {
      if (!nextTable) {
        setError('このQRコードは無効です')
        setLoading(false)
        setConfigLoading(false)
        return
      }

      setTable(nextTable)
      setOrderId(prev => {
        if (prev && nextTable.currentOrderId === prev) return prev
        return nextTable.currentOrderId ?? null
      })

      if (loadedConfigStoreIdRef.current !== nextTable.storeId) {
        loadedConfigStoreIdRef.current = nextTable.storeId
        setStoreConfig(STORE_CONFIG_DEFAULTS)
        setConfigLoading(true)
        const requestId = configRequestIdRef.current + 1
        configRequestIdRef.current = requestId
        loadCustomerStoreConfig(nextTable.storeId)
          .then(nextConfig => {
            if (configRequestIdRef.current !== requestId) return
            setStoreConfig(nextConfig)
          })
          .catch(() => {
            if (configRequestIdRef.current !== requestId) return
            setError('店舗設定の読み込みに失敗しました')
          })
          .finally(() => {
            if (configRequestIdRef.current !== requestId) return
            setConfigLoading(false)
          })
      }
      setLoading(false)
    }, () => {
      setError('読み込みに失敗しました')
      setLoading(false)
      setConfigLoading(false)
    })
  }, [qrToken])

  // 見えないログインは画面を開いたときに先に始めておく（着席・注文のときに待たせない）。
  useEffect(() => { trySignInCustomer() }, [qrToken])

  // この端末を席の今の注文に加える（注文履歴を読めるように）。2台目のスマホ・読み込み直しでも。
  // 開いている途中で別の注文に変わった（会計のあと次のお客様が座った）ときは、自動では加わらない。
  // この端末が着席した注文なら加わり済みの印があるので、少し待って印を確かめる。
  useEffect(() => {
    if (!orderId || !table) return undefined
    let cancelled = false
    setAccessError(false)
    const previousOrderId = seenOrderIdRef.current
    seenOrderIdRef.current = orderId
    const join = () => ensureCustomerOrderAccess({ storeId: table.storeId, tableId: table.id, orderId, qrToken })
      .then(() => { if (!cancelled) setAccessOrderId(orderId) })
      .catch(() => { if (!cancelled) setAccessError(true) })
    if (previousOrderId && previousOrderId !== orderId) {
      const timer = setTimeout(() => {
        if (cancelled) return
        if (isCustomerJoined(orderId)) join()
        else setSessionEnded(true)
      }, 2000)
      return () => { cancelled = true; clearTimeout(timer) }
    }
    join()
    return () => { cancelled = true }
  }, [orderId, table?.id, table?.storeId, qrToken, accessRetry])

  function retryCustomerAccess() {
    forgetCustomerJoined(orderId)
    setAccessRetry(value => value + 1)
  }

  if (sessionEnded) {
    return <OrderEntryStatus loading={false} error="お会計が終わりました。新しく注文するときは、席のQRをもう一度読み取ってください。" />
  }

  if (loading || error || !table) {
    return <OrderEntryStatus loading={loading} error={error} />
  }

  const entryBasePath = `/order/${qrToken}`
  const hasActiveOrder = Boolean(orderId)
  const requireActiveOrder = element => (
    hasActiveOrder ? element : <Navigate to={`${entryBasePath}/guests`} replace />
  )

  return (
    <OrderProvider value={{
      table,
      tableId: table.id,
      storeId: table.storeId,
      orderId,
      setOrderId,
      setTable,
      storeConfig,
      storeConfigLoading: configLoading,
      customerAccessReady: Boolean(orderId) && accessOrderId === orderId,
      customerAccessError: accessError,
      retryCustomerAccess,
    }}>
      <CartProvider key={orderId ?? 'no-order'} storageKey={cartStorageKey(orderId)}>
        <Suspense fallback={<AppRouteLoading compact />}>
          <Routes>
            <Route index element={
              <Navigate to={`${entryBasePath}/${getCustomerEntryStartPath(orderId)}`} replace />
            } />
            <Route path="guests" element={
              hasActiveOrder ? <Navigate to={`${entryBasePath}/menu`} replace /> : <GuestCountPage />
            } />
            <Route path="menu" element={requireActiveOrder(<MenuPage />)} />
            <Route path="cart" element={requireActiveOrder(<CartPage />)} />
            <Route path="complete" element={requireActiveOrder(<OrderCompletePage />)} />
          </Routes>
        </Suspense>
      </CartProvider>
    </OrderProvider>
  )
}
