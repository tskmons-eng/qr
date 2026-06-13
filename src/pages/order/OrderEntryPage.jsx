import { useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import OrderEntryStatus from '../../components/order/OrderEntryStatus'
import { CartProvider } from '../../contexts/CartContext'
import { OrderProvider } from '../../contexts/OrderContext'
import { CUSTOMER_ENTRY_CONFIG_DEFAULTS, getCustomerEntryStartPath } from '../../lib/customerEntry'
import { loadCustomerStoreConfig, subscribeCustomerTableByQrToken } from '../../services/customerEntryService'
import CartPage from './CartPage'
import GuestCountPage from './GuestCountPage'
import MenuPage from './MenuPage'
import OrderCompletePage from './OrderCompletePage'

export default function OrderEntryPage() {
  const { qrToken } = useParams()
  const [table, setTable] = useState(null)
  const [orderId, setOrderId] = useState(null)
  const [storeConfig, setStoreConfig] = useState(CUSTOMER_ENTRY_CONFIG_DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const loadedConfigStoreIdRef = useRef(null)

  useEffect(() => {
    return subscribeCustomerTableByQrToken(qrToken, nextTable => {
      if (!nextTable) {
        setError('このQRコードは無効です')
        setLoading(false)
        return
      }

      setTable(nextTable)
      setOrderId(prev => {
        if (prev && nextTable.currentOrderId === prev) return prev
        return nextTable.currentOrderId ?? null
      })

      if (loadedConfigStoreIdRef.current !== nextTable.storeId) {
        loadedConfigStoreIdRef.current = nextTable.storeId
        loadCustomerStoreConfig(nextTable.storeId).then(setStoreConfig)
      }
      setLoading(false)
    }, () => {
      setError('読み込みに失敗しました')
      setLoading(false)
    })
  }, [qrToken])

  if (loading || error) return <OrderEntryStatus loading={loading} error={error} />

  const entryBasePath = `/order/${qrToken}`
  const hasActiveOrder = Boolean(orderId)
  const requireActiveOrder = element => (
    hasActiveOrder ? element : <Navigate to={`${entryBasePath}/guests`} replace />
  )

  return (
    <OrderProvider value={{ table, tableId: table.id, storeId: table.storeId, orderId, setOrderId, setTable, storeConfig }}>
      <CartProvider>
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
      </CartProvider>
    </OrderProvider>
  )
}
