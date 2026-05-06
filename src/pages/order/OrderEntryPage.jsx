import { useEffect, useState } from 'react'
import { useParams, Routes, Route, Navigate } from 'react-router-dom'
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { OrderProvider } from '../../contexts/OrderContext'
import { CartProvider } from '../../contexts/CartContext'
import GuestCountPage from './GuestCountPage'
import MenuPage from './MenuPage'
import CartPage from './CartPage'
import OrderCompletePage from './OrderCompletePage'

const CONFIG_DEFAULTS = {
  showServedStatus: true,
  showItemPrice: true,
  allowAdditionalOrders: true,
}

export default function OrderEntryPage() {
  const { qrToken } = useParams()
  const [table, setTable] = useState(null)
  const [orderId, setOrderId] = useState(null)
  const [storeConfig, setStoreConfig] = useState(CONFIG_DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'tables'), where('qrToken', '==', qrToken))
    const unsub = onSnapshot(q, async snap => {
      if (snap.empty) {
        setError('このQRコードは無効です')
        setLoading(false)
        return
      }
      const d = snap.docs[0]
      const data = { id: d.id, ...d.data() }
      setTable(data)
      setOrderId(prev => {
        if (prev && data.currentOrderId === prev) return prev
        return data.currentOrderId ?? null
      })

      // storeConfigを初回のみ取得
      setStoreConfig(prev => {
        if (prev !== CONFIG_DEFAULTS) return prev
        getDoc(doc(db, 'storeConfig', data.storeId)).then(snap => {
          if (snap.exists()) {
            setStoreConfig({ ...CONFIG_DEFAULTS, ...snap.data() })
          }
        })
        return prev
      })

      setLoading(false)
    }, () => {
      setError('読み込みに失敗しました')
      setLoading(false)
    })
    return unsub
  }, [qrToken])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p style={{ color: '#999', fontSize: 15 }}>読み込み中...</p>
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 8 }}>
      <p style={{ color: '#dc2626', fontSize: 16 }}>{error}</p>
    </div>
  )

  return (
    <OrderProvider value={{ table, tableId: table.id, storeId: table.storeId, orderId, setOrderId, setTable, storeConfig }}>
      <CartProvider>
        <Routes>
          <Route index element={
            orderId
              ? <Navigate to="menu" replace />
              : <Navigate to="guests" replace />
          } />
          <Route path="guests" element={<GuestCountPage />} />
          <Route path="menu" element={<MenuPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="complete" element={<OrderCompletePage />} />
        </Routes>
      </CartProvider>
    </OrderProvider>
  )
}
