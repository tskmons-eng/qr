import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useStore } from '../../contexts/StoreContext'
import { StaffMemberContext } from '../../contexts/StaffMemberContext'
import { loadSoundPrefs, playSound } from '../../lib/sounds'
import { requestAndRegisterToken } from '../../lib/messaging'
import { hasStaffPermission } from '../../lib/staffPermissions'
import StaffCallBanner from '../../components/staff/StaffCallBanner'
import StaffShellHeader from '../../components/staff/StaffShellHeader'
import SoundSettingsPanel from '../../components/staff/SoundSettingsPanel'
import StaffEntryPage from './StaffEntryPage'
import StaffLoginScreen from '../../components/staff/StaffLoginScreen'
import { useAuth } from '../../contexts/AuthContext'
import { signOutCurrentUser } from '../../services/authSessionService'
import { activateStaffMemberSession } from '../../services/staffAuthService'
import { getNewCallIds, respondToStaffCall, subscribePendingCalls } from '../../services/staffCallService'
import ProductPage from '../admin/ProductPage'
import SalesPage from '../admin/SalesPage'
import TableListPage from './TableListPage'
import TableDetailPage from './TableDetailPage'
import StaffMenuPage from './StaffMenuPage'
import CheckoutPage from './CheckoutPage'
import RemainingPage from './RemainingPage'
import KitchenPage from '../kitchen/KitchenPage'

export default function StaffLayout() {
  const navigate = useNavigate()
  const { storeId, loading: storeLoading, clearDeviceStore } = useStore()
  const { user } = useAuth()
  const [activeStaff, setActiveStaff] = useState(() => {
    try { return JSON.parse(localStorage.getItem('activeStaff')) } catch { return null }
  })

  function setActiveStaffPersisted(staff) {
    if (staff) localStorage.setItem('activeStaff', JSON.stringify(staff))
    else localStorage.removeItem('activeStaff')
    setActiveStaff(staff)
  }

  async function handleStaffLogin(staff) {
    await activateStaffMemberSession({ storeId, staff })
    setActiveStaffPersisted(staff)
  }

  const [calls, setCalls] = useState([])
  const [showSoundSettings, setShowSoundSettings] = useState(false)
  const [notifStatus, setNotifStatus] = useState('none')
  const prevCallIdsRef = useRef(null)

  async function registerNotif(sid, staffId) {
    setNotifStatus('loading')
    const token = await requestAndRegisterToken(sid, staffId)
    if (token) {
      setNotifStatus('ok')
    } else {
      setNotifStatus('failed')
    }
  }

  // スタッフがログインしたら毎回トークンを更新する（PWA/ブラウザ切替に対応）
  useEffect(() => {
    if (!storeId || !activeStaff) return
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return
    if (Notification.permission === 'granted') {
      registerNotif(storeId, activeStaff.id)
    }
  }, [storeId, activeStaff?.id])

  async function handleEnableNotif() {
    await registerNotif(storeId, activeStaff.id)
  }

  useEffect(() => {
    if (!storeId || !activeStaff) return
    return subscribePendingCalls(storeId, data => {
      if (getNewCallIds(data, prevCallIdsRef.current).length > 0) {
        const { soundId, volume } = loadSoundPrefs()
        playSound(soundId, volume)
      }
      prevCallIdsRef.current = new Set(data.map(d => d.id))
      setCalls(data)
    })
  }, [storeId, activeStaff?.id])

  async function handleLogout() {
    clearDeviceStore()
    await signOutCurrentUser()
    navigate('/staff')
  }

  async function handleRespond(call) {
    const handled = await respondToStaffCall({
      callId: call.id,
      staffId: activeStaff?.id,
      staffName: activeStaff?.name,
    })
    if (handled) navigate(`/staff/table/${call.tableId}`)
  }

  if (user === undefined || storeLoading) return null

  if (!storeId) return <StaffEntryPage />

  if (!activeStaff) {
    return (
      <StaffMemberContext.Provider value={{ activeStaff, setActiveStaff: setActiveStaffPersisted }}>
        <StaffLoginScreen storeId={storeId} onLogin={handleStaffLogin} onLogout={handleLogout} />
      </StaffMemberContext.Provider>
    )
  }

  const canUseKitchen = hasStaffPermission(activeStaff, 'useKitchen')
  const canCloseRegister = hasStaffPermission(activeStaff, 'closeRegister', { useKitchen: true, closeRegister: false, manageMenu: false })
  const canManageMenu = hasStaffPermission(activeStaff, 'manageMenu', { useKitchen: true, closeRegister: false, manageMenu: false })

  return (
    <StaffMemberContext.Provider value={{ activeStaff, setActiveStaff: setActiveStaffPersisted }}>
      <div className="staff-shell">
        <StaffShellHeader
          activeStaff={activeStaff}
          callCount={calls.length}
          notifStatus={notifStatus}
          showAdmin={!user?.isAnonymous}
          canUseKitchen={canUseKitchen}
          canCloseRegister={canCloseRegister}
          canManageMenu={canManageMenu}
          onEnableNotif={handleEnableNotif}
          onToggleSoundSettings={() => setShowSoundSettings(v => !v)}
          onRefresh={() => window.location.reload()}
          onSwitchStaff={() => setActiveStaffPersisted(null)}
          onOpenKitchen={() => navigate('/staff/kitchen')}
          onOpenSales={() => navigate('/staff/sales')}
          onOpenMenuAdmin={() => navigate('/staff/menu-admin')}
          onOpenAdmin={() => navigate('/admin')}
          onLogout={handleLogout}
        />

        {showSoundSettings && <SoundSettingsPanel onClose={() => setShowSoundSettings(false)} />}

        <StaffCallBanner calls={calls} onRespond={handleRespond} />

        <Routes>
          <Route index element={<TableListPage />} />
          <Route path="kitchen" element={
            <StaffPermissionGate activeStaff={activeStaff} permission="useKitchen">
              <KitchenPage />
            </StaffPermissionGate>
          } />
          <Route path="sales" element={
            <StaffPermissionGate activeStaff={activeStaff} permission="closeRegister" elevated>
              <SalesPage />
            </StaffPermissionGate>
          } />
          <Route path="menu-admin" element={
            <StaffPermissionGate activeStaff={activeStaff} permission="manageMenu" elevated>
              <ProductPage />
            </StaffPermissionGate>
          } />
          <Route path="table/:tableId" element={<TableDetailPage />} />
          <Route path="table/:tableId/remaining" element={<RemainingPage />} />
          <Route path="table/:tableId/add-order" element={<StaffMenuPage />} />
          <Route path="table/:tableId/checkout" element={<CheckoutPage />} />
          <Route path="*" element={<Navigate to="/staff" replace />} />
        </Routes>
      </div>
    </StaffMemberContext.Provider>
  )
}

function StaffPermissionGate({ activeStaff, children, elevated = false, permission }) {
  const legacyDefaults = elevated
    ? { useKitchen: true, closeRegister: false, manageMenu: false }
    : undefined
  if (hasStaffPermission(activeStaff, permission, legacyDefaults)) return children

  return (
    <div className="staff-shell__permission-denied">
      <div className="staff-shell__permission-title">権限がありません</div>
      <div className="staff-shell__permission-text">管理者にスタッフ権限の変更を依頼してください。</div>
    </div>
  )
}
