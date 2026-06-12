import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useStore } from '../../contexts/StoreContext'
import { StaffMemberContext } from '../../contexts/StaffMemberContext'
import { loadSoundPrefs, playSound } from '../../lib/sounds'
import { hasRegisteredNotificationToken, removeRegisteredNotificationToken, requestAndRegisterToken } from '../../lib/messaging'
import { clearStaffAutoLoginPreference } from '../../lib/staffMember'
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
import { loadStoreConfig } from '../../services/settingsService'
import ProductPage from '../admin/ProductPage'
import SalesPage from '../admin/SalesPage'
import StaffPage from '../admin/StaffPage'
import TablePage from '../admin/TablePage'
import ReservationPage from '../admin/ReservationPage'
import HistoryPage from '../admin/HistoryPage'
import SettingsPage from '../admin/SettingsPage'
import TableListPage from './TableListPage'
import TableDetailPage from './TableDetailPage'
import StaffMenuPage from './StaffMenuPage'
import CheckoutPage from './CheckoutPage'
import RemainingPage from './RemainingPage'
import KitchenPage from '../kitchen/KitchenPage'

const ELEVATED_PERMISSION_DEFAULTS = {
  useKitchen: true,
  closeRegister: false,
  manageMenu: false,
  manageTables: false,
  manageReservations: false,
  viewHistory: false,
  manageSettings: false,
  manageStaff: false,
}

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
  const [notifStatus, setNotifStatus] = useState(() => hasRegisteredNotificationToken() ? 'ok' : 'none')
  const [storeConfig, setStoreConfig] = useState(null)
  const prevCallIdsRef = useRef(null)
  const notificationsEnabled = storeConfig?.notificationsEnabled !== false

  async function registerNotif(sid, staffId) {
    if (!notificationsEnabled) return null
    setNotifStatus('loading')
    const token = await requestAndRegisterToken(sid, staffId)
    if (token) {
      setNotifStatus('ok')
    } else {
      setNotifStatus('failed')
    }
  }

  useEffect(() => {
    if (!storeId) return
    loadStoreConfig(storeId).then(setStoreConfig)
  }, [storeId])

  useEffect(() => {
    if (storeConfig && !notificationsEnabled) {
      removeRegisteredNotificationToken().then(() => setNotifStatus('none'))
    }
  }, [notificationsEnabled, storeConfig])

  // スタッフがログインしたら毎回トークンを更新する（PWA/ブラウザ切替に対応）
  useEffect(() => {
    if (!storeId || !activeStaff || !notificationsEnabled) return
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return
    if (Notification.permission === 'granted') {
      registerNotif(storeId, activeStaff.id)
    }
  }, [notificationsEnabled, storeId, activeStaff?.id])

  async function handleEnableNotif() {
    await registerNotif(storeId, activeStaff.id)
  }

  async function handleDisableNotif() {
    await removeRegisteredNotificationToken()
    setNotifStatus('none')
  }

  useEffect(() => {
    if (!storeId || !activeStaff) return
    return subscribePendingCalls(storeId, data => {
      if (getNewCallIds(data, prevCallIdsRef.current).length > 0) {
        if (notificationsEnabled) {
          const { soundId, volume } = loadSoundPrefs()
          playSound(soundId, volume)
        }
      }
      prevCallIdsRef.current = new Set(data.map(d => d.id))
      setCalls(data)
    })
  }, [notificationsEnabled, storeId, activeStaff?.id])

  async function handleLogout() {
    await removeRegisteredNotificationToken()
    clearStaffAutoLoginPreference(storeId)
    setActiveStaffPersisted(null)
    clearDeviceStore()
    await signOutCurrentUser()
    navigate('/staff')
  }

  function handleSwitchStaff() {
    clearStaffAutoLoginPreference(storeId)
    setActiveStaffPersisted(null)
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
        <StaffLoginScreen
          canOpenStaffAdmin={Boolean(user && !user.isAnonymous)}
          forceAnonymousStoreEntry={Boolean(user && !user.isAnonymous)}
          storeId={storeId}
          onLogin={handleStaffLogin}
          onLogout={handleLogout}
          onOpenStaffAdmin={() => navigate(user && !user.isAnonymous ? '/admin/staff' : '/login')}
        />
      </StaffMemberContext.Provider>
    )
  }

  const canUseKitchen = hasStaffPermission(activeStaff, 'useKitchen')
  const canCloseRegister = hasStaffPermission(activeStaff, 'closeRegister', ELEVATED_PERMISSION_DEFAULTS)
  const canManageMenu = hasStaffPermission(activeStaff, 'manageMenu', ELEVATED_PERMISSION_DEFAULTS)
  const canManageTables = hasStaffPermission(activeStaff, 'manageTables', ELEVATED_PERMISSION_DEFAULTS)
  const canManageReservations = hasStaffPermission(activeStaff, 'manageReservations', ELEVATED_PERMISSION_DEFAULTS)
  const canViewHistory = hasStaffPermission(activeStaff, 'viewHistory', ELEVATED_PERMISSION_DEFAULTS)
  const canManageSettings = hasStaffPermission(activeStaff, 'manageSettings', ELEVATED_PERMISSION_DEFAULTS)
  const canManageStaff = hasStaffPermission(activeStaff, 'manageStaff', ELEVATED_PERMISSION_DEFAULTS)

  return (
    <StaffMemberContext.Provider value={{ activeStaff, setActiveStaff: setActiveStaffPersisted }}>
      <div className="staff-shell">
        <StaffShellHeader
          activeStaff={activeStaff}
          callCount={calls.length}
          showAdmin={!user?.isAnonymous}
          canUseKitchen={canUseKitchen}
          canCloseRegister={canCloseRegister}
          canManageMenu={canManageMenu}
          canManageTables={canManageTables}
          canManageReservations={canManageReservations}
          canViewHistory={canViewHistory}
          canManageSettings={canManageSettings}
          canManageStaff={canManageStaff}
          onToggleSoundSettings={() => setShowSoundSettings(v => !v)}
          onRefresh={() => window.location.reload()}
          onSwitchStaff={handleSwitchStaff}
          onOpenKitchen={() => navigate('/staff/kitchen')}
          onOpenSales={() => navigate('/staff/sales')}
          onOpenTables={() => navigate('/staff/tables')}
          onOpenReservations={() => navigate('/staff/reservations')}
          onOpenMenuAdmin={() => navigate('/staff/menu-admin')}
          onOpenHistory={() => navigate('/staff/history')}
          onOpenSettings={() => navigate('/staff/settings')}
          onOpenStaffAdmin={() => navigate('/staff/staff-admin')}
          onOpenAdmin={() => navigate('/admin')}
          onLogout={handleLogout}
        />

        {showSoundSettings && (
          <SoundSettingsPanel
            notificationsEnabled={notificationsEnabled}
            notifStatus={notifStatus}
            onClose={() => setShowSoundSettings(false)}
            onDisableNotif={handleDisableNotif}
            onEnableNotif={handleEnableNotif}
          />
        )}

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
          <Route path="tables" element={
            <StaffPermissionGate activeStaff={activeStaff} permission="manageTables" elevated>
              <TablePage />
            </StaffPermissionGate>
          } />
          <Route path="reservations" element={
            <StaffPermissionGate activeStaff={activeStaff} permission="manageReservations" elevated>
              <ReservationPage />
            </StaffPermissionGate>
          } />
          <Route path="history" element={
            <StaffPermissionGate activeStaff={activeStaff} permission="viewHistory" elevated>
              <HistoryPage />
            </StaffPermissionGate>
          } />
          <Route path="settings" element={
            <StaffPermissionGate activeStaff={activeStaff} permission="manageSettings" elevated>
              <SettingsPage />
            </StaffPermissionGate>
          } />
          <Route path="staff-admin" element={
            <StaffPermissionGate activeStaff={activeStaff} permission="manageStaff" elevated>
              <StaffPage />
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
  const legacyDefaults = elevated ? ELEVATED_PERMISSION_DEFAULTS : undefined
  if (hasStaffPermission(activeStaff, permission, legacyDefaults)) return children

  return (
    <div className="staff-shell__permission-denied">
      <div className="staff-shell__permission-title">権限がありません</div>
      <div className="staff-shell__permission-text">管理者にスタッフ権限の変更を依頼してください。</div>
    </div>
  )
}
