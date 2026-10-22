import { useState, useEffect, useMemo, useRef } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../../contexts/StoreContext'
import { StaffMemberContext } from '../../contexts/StaffMemberContext'
import { loadSoundPrefs, playSound } from '../../lib/sounds'
import { hasRegisteredNotificationToken, removeRegisteredNotificationToken, requestAndRegisterToken } from '../../lib/messaging'
import { buildStoreManagerStaff, clearStaffAutoLoginPreference } from '../../lib/staffMember'
import { hasStaffPermission } from '../../lib/staffPermissions'
import { getOrderCommandErrorCode } from '../../lib/orderCommandErrors'
import StaffCallBanner from '../../components/staff/StaffCallBanner'
import StaffReservationWaitController from '../../components/staff/StaffReservationWaitController'
import StaffShellHeader from '../../components/staff/StaffShellHeader'
import StaffPullRefreshIndicator from '../../components/staff/StaffPullRefreshIndicator'
import StaffEntryPage from './StaffEntryPage'
import StaffLoginScreen from '../../components/staff/StaffLoginScreen'
import { useAuth } from '../../contexts/AuthContext'
import { signOutCurrentUser } from '../../services/authSessionService'
import { activateStaffMemberSession } from '../../services/staffAuthService'
import { loadStoreIdentity } from '../../services/settingsService'
import { getNewCallIds, respondToStaffCall, subscribePendingCalls } from '../../services/staffCallService'
import useStoreConfig from '../../hooks/useStoreConfig'
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
import SalesAssigneeManagementPage from './SalesAssigneeManagementPage'
import CheckoutPage from './CheckoutPage'
import RemainingPage from './RemainingPage'
import KitchenPage from '../kitchen/KitchenPage'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'

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

const STAFF_RESELECT_ERROR_CODES = new Set(['staff-code-required', 'staff-member-not-found', 'permission-denied', 'invalid-argument'])

const STAFF_ADMIN_LOGIN_PATH = `/login?next=${encodeURIComponent('/staff/staff-admin')}`

export default function StaffLayout() {
  const navigate = useNavigate()
  const isTableListPage = useLocation().pathname.replace(/\/+$/, '') === '/staff'
  const { storeId, loading: storeLoading, clearDeviceStore, ownerActiveStoreId, clearOwnerStore } = useStore()
  const { user } = useAuth()
  const [storedStaff, setStoredStaff] = useState(() => {
    try { return JSON.parse(localStorage.getItem('activeStaff')) } catch { return null }
  })
  const [storeIdentity, setStoreIdentity] = useState(null)
  // Google でログインした店長・オーナーは、スタッフを選ばずに「管理者」として入る（K10 の直し）。
  const storeManagerStaff = useMemo(() => buildStoreManagerStaff(user), [user])
  const activeStaff = storeManagerStaff ?? storedStaff

  function setActiveStaffPersisted(staff) {
    if (staff) localStorage.setItem('activeStaff', JSON.stringify(staff))
    else localStorage.removeItem('activeStaff')
    setStoredStaff(staff)
  }

  useEffect(() => {
    // 店を切り替えたら、前の店の名前を出したままにしない。
    setStoreIdentity(null)
    if (!storeId) return undefined
    let active = true
    loadStoreIdentity(storeId)
      .then(identity => { if (active) setStoreIdentity(identity) })
      .catch(() => { if (active) setStoreIdentity(null) })
    return () => { active = false }
  }, [storeId])

  // サーバーは、4桁パスを照合した端末の記録（staffSessions）で「誰が操作したか」を決める（2026-10-22 第4章）。
  // 画面を開くたびに、この端末で照合済みのスタッフかを確かめる。違えば（パスや権限が変わった・古い端末）選び直してもらう。
  const storedStaffId = storedStaff?.id
  useEffect(() => {
    if (!storeId || !storedStaff || storeManagerStaff) return
    activateStaffMemberSession({ storeId, staff: storedStaff }).catch(error => {
      // 通信の一時的な失敗では外さない（混雑時に全員がパスを入れ直すことになる）。照合できないと分かったときだけ選び直す。
      if (STAFF_RESELECT_ERROR_CODES.has(getOrderCommandErrorCode(error))) setActiveStaffPersisted(null)
    })
  },[storeId, storedStaffId, storeManagerStaff])

  async function handleStaffLogin(staff, code) {
    await activateStaffMemberSession({ storeId, staff, code })
    setActiveStaffPersisted(staff)
  }

  const [calls, setCalls] = useState([])
  const [notifStatus, setNotifStatus] = useState(() => hasRegisteredNotificationToken() ? 'ok' : 'none')
  const storeConfig = useStoreConfig(storeId)
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
    if (!storeId || !activeStaff?.id) return
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

  function handleBackToOwner() {
    clearOwnerStore()
    navigate('/owner')
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

  // 席一覧の「対応」：その席の呼び出しをまとめて対応済みにし、一覧のままにする。
  async function handleRespondCalls(tableCalls) {
    await Promise.all(tableCalls.map(call => respondToStaffCall({
      callId: call.id,
      staffId: activeStaff?.id,
      staffName: activeStaff?.name,
    })))
  }

  const pullRefresh = usePullToRefresh({
    enabled: Boolean(storeId && activeStaff),
    onRefresh: () => window.location.reload(),
  })

  if (user === undefined || storeLoading) return null

  if (!storeId) return <StaffEntryPage />

  if (!activeStaff) {
    return (
      <StaffMemberContext.Provider value={{ activeStaff, setActiveStaff: setActiveStaffPersisted }}>
        <StaffLoginScreen
          storeId={storeId}
          storeName={storeIdentity?.storeName ?? ''}
          onLogin={handleStaffLogin}
          onLogout={handleLogout}
          onOpenAdminLogin={() => navigate(STAFF_ADMIN_LOGIN_PATH)}
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
  const notificationControls = {
    notificationsEnabled,
    notifStatus,
    onDisableNotif: handleDisableNotif,
    onEnableNotif: handleEnableNotif,
  }

  return (
    <StaffMemberContext.Provider value={{ activeStaff, setActiveStaff: setActiveStaffPersisted }}>
      <div className={['staff-shell', pullRefresh.className].filter(Boolean).join(' ')} style={pullRefresh.style}>
        <StaffPullRefreshIndicator phase={pullRefresh.phase} text={pullRefresh.text} />

        <div className="staff-shell__pull-content">
          {ownerActiveStoreId && (
            <div className="staff-shell__owner-band">
              <span>代理管理中：{storeIdentity?.storeName || '店舗'}</span>
              <button type="button" onClick={handleBackToOwner}>オーナー一覧へ</button>
            </div>
          )}
          <StaffShellHeader
            activeStaff={activeStaff}
            storeName={storeIdentity?.storeName ?? ''}
            storeCode={storeIdentity?.storeCode ?? ''}
            callCount={calls.length}
            canUseKitchen={canUseKitchen}
            canCloseRegister={canCloseRegister}
            canManageMenu={canManageMenu}
            canManageTables={canManageTables}
            canManageReservations={canManageReservations}
            canViewHistory={canViewHistory}
            canManageSettings={canManageSettings}
            canManageStaff={canManageStaff}
            onOpenOrders={() => navigate('/staff')}
            onSwitchStaff={activeStaff.isStoreManager ? null : handleSwitchStaff}
            onOpenKitchen={() => navigate('/staff/kitchen')}
            onOpenSales={() => navigate('/staff/sales')}
            onOpenSalesAssignees={() => navigate('/staff/sales-assignees')}
            onOpenTables={() => navigate('/staff/tables')}
            onOpenReservations={() => navigate('/staff/reservations')}
            onOpenMenuAdmin={() => navigate('/staff/menu-admin')}
            onOpenHistory={() => navigate('/staff/history')}
            onOpenSettings={() => navigate('/staff/settings')}
            onOpenStaffAdmin={() => navigate('/staff/staff-admin')}
            onLogout={handleLogout}
          />

          {/* 席一覧は「対応が要る席」の行で対応するので、帯は出さない（ユーザー様 2026-10-22）。 */}
          {!isTableListPage && <StaffCallBanner calls={calls} onRespond={handleRespond} />}
          <StaffReservationWaitController
            activeStaff={activeStaff}
            notificationsEnabled={notificationsEnabled}
            storeId={storeId}
            onOpenTable={tableId => navigate(`/staff/table/${tableId}`)}
          />

          <Routes>
            <Route index element={<TableListPage calls={calls} onRespondCalls={handleRespondCalls} />} />
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
            <Route path="sales-assignees" element={
              <StaffPermissionGate activeStaff={activeStaff} permission="manageStaff" elevated>
                <SalesAssigneeManagementPage />
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
                <SettingsPage
                  notificationControls={notificationControls}
                />
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
