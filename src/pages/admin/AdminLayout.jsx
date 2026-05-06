import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../../lib/firebase'
import { useStore } from '../../contexts/StoreContext'
import { useAuth } from '../../contexts/AuthContext'
import ProductPage from './ProductPage'
import TablePage from './TablePage'
import SalesPage from './SalesPage'
import StaffPage from './StaffPage'
import HistoryPage from './HistoryPage'
import SettingsPage from './SettingsPage'
import ReservationPage from './ReservationPage'

const tabs = [
  { to: '/admin/products', label: '商品・カテゴリー' },
  { to: '/admin/tables', label: '席' },
  { to: '/admin/staff', label: 'スタッフ' },
  { to: '/admin/reservations', label: '予約' },
  { to: '/admin/sales', label: '売上・締め' },
  { to: '/admin/history', label: '操作履歴' },
  { to: '/admin/settings', label: '設定' },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const { storeId } = useStore()
  const { user } = useAuth()
  const [storeCode, setStoreCode] = useState('')

  useEffect(() => {
    if (!storeId || !user || user.isAnonymous) return
    getDoc(doc(db, 'stores', storeId)).then(snap => {
      if (snap.exists()) setStoreCode(snap.data().storeCode ?? '')
    })
  }, [storeId, user])

  async function handleLogout() {
    await signOut(auth)
    navigate('/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <header style={{ background: '#222', color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ margin: 0, fontSize: 17 }}>管理画面</h1>
          <NavLink to="/staff" style={{ color: '#aaa', fontSize: 13, textDecoration: 'none' }}>← スタッフ画面</NavLink>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {storeCode && (
            <span style={{ fontSize: 13, color: '#aaa' }}>
              店舗コード: <span style={{ color: '#fff', fontWeight: 700, letterSpacing: 3 }}>{storeCode}</span>
            </span>
          )}
          <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #666', color: '#ccc', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
            ログアウト
          </button>
        </div>
      </header>

      <nav style={{ background: '#fff', borderBottom: '1px solid #ddd', display: 'flex', padding: '0 16px' }}>
        {tabs.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              padding: '12px 16px',
              textDecoration: 'none',
              color: isActive ? '#1a73e8' : '#555',
              borderBottom: isActive ? '2px solid #1a73e8' : '2px solid transparent',
              fontSize: 14,
              fontWeight: isActive ? 600 : 400,
            })}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <main style={{ padding: 16, maxWidth: 800, margin: '0 auto' }}>
        <Routes>
          <Route path="products" element={<ProductPage />} />
          <Route path="tables" element={<TablePage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="reservations" element={<ReservationPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/admin/categories" replace />} />
        </Routes>
      </main>
    </div>
  )
}
