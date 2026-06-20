import { useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useStore } from '../../contexts/StoreContext'
import { isSuperAdminEmail } from '../../lib/ownerIdentity'
import { signOutCurrentUser } from '../../services/authSessionService'
import { loadStoreIdentity } from '../../services/settingsService'
import CategoryPage from './CategoryPage'
import HistoryPage from './HistoryPage'
import ProductPage from './ProductPage'
import ReservationPage from './ReservationPage'
import SalesPage from './SalesPage'
import SettingsPage from './SettingsPage'
import StaffPage from './StaffPage'
import TablePage from './TablePage'

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
  const { clearOwnerStore, ownerActiveStoreId, storeId } = useStore()
  const { user } = useAuth()
  const [storeIdentity, setStoreIdentity] = useState({ storeCode: '', storeName: '' })
  const isOwnerManagedStore = Boolean(ownerActiveStoreId) && isSuperAdminEmail(user?.email?.trim().toLowerCase())

  useEffect(() => {
    if (!storeId || !user || user.isAnonymous) return
    loadStoreIdentity(storeId).then(setStoreIdentity)
  }, [storeId, user])

  async function handleLogout() {
    await signOutCurrentUser()
    navigate('/login')
  }

  function handleBackToOwner() {
    clearOwnerStore()
    navigate('/owner')
  }

  return (
    <div className="admin-layout">
      <header className="admin-layout__header">
        <div className="admin-layout__header-main">
          <h1 className="admin-layout__title">管理画面</h1>
          <NavLink to="/staff" className="admin-layout__staff-link">← スタッフ画面</NavLink>
          {isOwnerManagedStore && (
            <button type="button" onClick={handleBackToOwner} className="admin-layout__owner-return">
              ← オーナー一覧
            </button>
          )}
        </div>
        <div className="admin-layout__header-actions">
          {isOwnerManagedStore && storeIdentity.storeName && (
            <span className="admin-layout__owner-store">
              代理管理: <span className="admin-layout__owner-store-name">{storeIdentity.storeName}</span>
            </span>
          )}
          {storeIdentity.storeCode && (
            <span className="admin-layout__store-code">
              店舗コード: <span className="admin-layout__store-code-value">{storeIdentity.storeCode}</span>
            </span>
          )}
          <button type="button" onClick={handleLogout} className="admin-layout__logout">
            ログアウト
          </button>
        </div>
      </header>

      <nav className="admin-layout__nav">
        {tabs.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `admin-layout__tab${isActive ? ' is-active' : ''}`}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <main className="admin-layout__main">
        <Routes>
          <Route path="products" element={<ProductPage />} />
          <Route path="tables" element={<TablePage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="reservations" element={<ReservationPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="categories" element={<CategoryPage />} />
          <Route path="*" element={<Navigate to="/admin/categories" replace />} />
        </Routes>
      </main>
    </div>
  )
}
