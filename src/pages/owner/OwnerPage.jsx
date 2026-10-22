import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import OwnerHeader from '../../components/owner/OwnerHeader'
import OwnerStoreDashboard from '../../components/owner/OwnerStoreDashboard'
import OwnerStoreInviteSheet from '../../components/owner/OwnerStoreInviteSheet'
import { useAuth } from '../../contexts/AuthContext'
import { useStore } from '../../contexts/StoreContext'
import { formatOrderCommandError } from '../../lib/orderCommandErrors'
import { signOutCurrentUser } from '../../services/authSessionService'
import { loadOwnerDashboardData, updateStoreAdminEmail, updateStoreName } from '../../services/ownerDashboardService'
import { createStore, reissueStoreInvite } from '../../services/storeOnboardingService'

// 運営者の画面（2026-10-22 店舗登録で作り直し）。店は「店舗を追加」で店舗名だけ入れて作り、店長には招待を渡す。
// 許可メールのタブは無くした（店長は招待で入る）。
export default function OwnerPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { activateOwnerStore, ownerActiveStoreId } = useStore()
  const [dashboard, setDashboard] = useState(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardError, setDashboardError] = useState('')
  const [ownerEmailSavingStoreId, setOwnerEmailSavingStoreId] = useState('')
  const [storeNameSavingStoreId, setStoreNameSavingStoreId] = useState('')
  const [inviteBusyStoreId, setInviteBusyStoreId] = useState('')
  const [sheetMode, setSheetMode] = useState(null)
  const [inviteResult, setInviteResult] = useState(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    setDashboardLoading(true)
    setDashboardError('')
    try {
      setDashboard(await loadOwnerDashboardData())
    } catch {
      setDashboardError('店舗一覧の読み込みに失敗しました')
    } finally {
      setDashboardLoading(false)
    }
  }

  function openCreateSheet() {
    setCreateError('')
    setInviteResult(null)
    setSheetMode('create')
  }

  async function handleCreateStore(storeName) {
    setCreating(true)
    setCreateError('')
    try {
      const result = await createStore({ storeName })
      setInviteResult({ ...result, created: true })
      setSheetMode('result')
      loadDashboard()
    } catch (createFailure) {
      setCreateError(formatOrderCommandError(createFailure, { context: 'storeCreate' }).message)
    } finally {
      setCreating(false)
    }
  }

  async function handleIssueInvite(store) {
    setInviteBusyStoreId(store.id)
    setDashboardError('')
    try {
      const result = await reissueStoreInvite({ storeId: store.id })
      setInviteResult({ ...result, created: false })
      setSheetMode('result')
      loadDashboard()
    } catch (inviteFailure) {
      setDashboardError(formatOrderCommandError(inviteFailure).message)
    } finally {
      setInviteBusyStoreId('')
    }
  }

  async function handleStoreAdminEmailSave({ storeId, currentEmail, nextEmail }) {
    setOwnerEmailSavingStoreId(storeId)
    setDashboardError('')
    try {
      await updateStoreAdminEmail({
        storeId,
        currentEmail,
        nextEmail,
        updatedBy: user?.email ?? null,
      })
      await loadDashboard()
    } catch (saveError) {
      setDashboardError(saveError.message || '店長のメールの保存に失敗しました')
    } finally {
      setOwnerEmailSavingStoreId('')
    }
  }

  async function handleStoreNameSave({ storeId, storeName }) {
    setStoreNameSavingStoreId(storeId)
    setDashboardError('')
    try {
      await updateStoreName({
        storeId,
        storeName,
        updatedBy: user?.email ?? null,
      })
      await loadDashboard()
    } catch (saveError) {
      setDashboardError(saveError.message || '店舗名の保存に失敗しました')
    } finally {
      setStoreNameSavingStoreId('')
    }
  }

  function handleManageStore(store) {
    const activated = activateOwnerStore(store.id)
    if (!activated) {
      setDashboardError('この操作はスーパー管理者だけが利用できます')
      return
    }
    navigate('/staff/settings')
  }

  return (
    <div className="owner-page">
      <OwnerHeader onSignOut={signOutCurrentUser} />
      <main className="owner-content">
        <OwnerStoreDashboard
          dashboard={dashboard}
          error={dashboardError}
          loading={dashboardLoading}
          inviteBusyStoreId={inviteBusyStoreId}
          ownerEmailSavingStoreId={ownerEmailSavingStoreId}
          ownerActiveStoreId={ownerActiveStoreId}
          storeNameSavingStoreId={storeNameSavingStoreId}
          onAddStore={openCreateSheet}
          onIssueInvite={handleIssueInvite}
          onManageStore={handleManageStore}
          onOwnerEmailSave={handleStoreAdminEmailSave}
          onStoreNameSave={handleStoreNameSave}
          onRefresh={loadDashboard}
        />
      </main>
      <OwnerStoreInviteSheet
        mode={sheetMode}
        result={inviteResult}
        busy={creating}
        error={createError}
        onCreate={handleCreateStore}
        onClose={() => setSheetMode(null)}
      />
    </div>
  )
}
