import { useEffect, useRef, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
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
  { to: '/admin/products', label: '商品・カテゴリー', mobileLabel: '商品' },
  { to: '/admin/tables', label: '席', mobileLabel: '席' },
  { to: '/admin/staff', label: 'スタッフ', mobileLabel: 'スタッフ' },
  { to: '/admin/reservations', label: '予約', mobileLabel: '予約' },
  { to: '/admin/sales', label: '売上・会計', mobileLabel: '売上' },
  { to: '/admin/history', label: '操作ログ', mobileLabel: '操作ログ' },
  { to: '/admin/settings', label: '設定', mobileLabel: '設定' },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { clearOwnerStore, ownerActiveStoreId, storeId } = useStore()
  const { user } = useAuth()
  const [storeIdentity, setStoreIdentity] = useState({ storeCode: '', storeName: '' })
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const menuButtonRef = useRef(null)
  const navRef = useRef(null)
  const isOwnerManagedStore = Boolean(ownerActiveStoreId) && isSuperAdminEmail(user?.email?.trim().toLowerCase())

  useEffect(() => {
    if (!storeId || !user || user.isAnonymous) return
    loadStoreIdentity(storeId).then(setStoreIdentity)
  }, [storeId, user])

  useEffect(() => {
    setMenuOpen(false)

    const nav = navRef.current
    const activeTab = nav?.querySelector('[aria-current="page"]')
    if (nav && activeTab && nav.scrollWidth > nav.clientWidth && typeof activeTab.scrollIntoView === 'function') {
      activeTab.scrollIntoView({ block: 'nearest', inline: 'center' })
    }
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return undefined

    function handlePointerDown(event) {
      if (menuRef.current?.contains(event.target)) return
      setMenuOpen(false)
    }

    function handleKeyDown(event) {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      menuButtonRef.current?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  async function handleLogout() {
    setMenuOpen(false)
    await signOutCurrentUser()
    navigate('/login')
  }

  function handleBackToOwner() {
    setMenuOpen(false)
    clearOwnerStore()
    navigate('/owner')
  }

  return (
    <div className="admin-layout">
      <header className="admin-layout__header">
        <div className={`admin-layout__header-main${isOwnerManagedStore ? ' is-owner-managed' : ''}`}>
          <h1 className="admin-layout__title">管理画面</h1>
          <NavLink to="/staff" className="admin-layout__staff-link" aria-label="スタッフ画面へ戻る">
            <span className="admin-layout__desktop-label">← スタッフ画面</span>
            <span className="admin-layout__mobile-label">← 戻る</span>
          </NavLink>
          {isOwnerManagedStore && (
            <button
              type="button"
              onClick={handleBackToOwner}
              className="admin-layout__owner-return"
              aria-label="オーナー一覧へ戻る"
            >
              <span className="admin-layout__desktop-label">← オーナー一覧</span>
              <span className="admin-layout__mobile-label">← オーナー</span>
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
          <div className="admin-layout__menu" ref={menuRef}>
            <button
              ref={menuButtonRef}
              type="button"
              className="admin-layout__menu-button"
              aria-expanded={menuOpen}
              aria-controls="admin-layout-menu"
              onClick={() => setMenuOpen(open => !open)}
            >
              メニュー
            </button>
            {menuOpen && (
              <div id="admin-layout-menu" className="admin-layout__menu-popover">
                {(isOwnerManagedStore || storeIdentity.storeCode) && (
                  <div className="admin-layout__menu-context" role="presentation">
                    {isOwnerManagedStore && (
                      <span className="admin-layout__menu-context-label">
                        代理管理: {storeIdentity.storeName || '選択中の店舗'}
                      </span>
                    )}
                    {storeIdentity.storeCode && (
                      <span className="admin-layout__menu-store-code">
                        店舗コード: <strong>{storeIdentity.storeCode}</strong>
                      </span>
                    )}
                  </div>
                )}
                {isOwnerManagedStore && (
                  <NavLink
                    to="/staff"
                    className="admin-layout__menu-item"
                    onClick={() => setMenuOpen(false)}
                  >
                    スタッフ画面
                  </NavLink>
                )}
                <button type="button" className="admin-layout__menu-item" onClick={handleLogout}>
                  ログアウト
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="admin-layout__nav-shell">
        <nav ref={navRef} className="admin-layout__nav" aria-label="管理画面">
          {tabs.map(({ to, label, mobileLabel }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `admin-layout__tab${isActive ? ' is-active' : ''}`}
            >
              <span className="admin-layout__desktop-label">{label}</span>
              <span className="admin-layout__mobile-label">{mobileLabel}</span>
            </NavLink>
          ))}
        </nav>
      </div>

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
