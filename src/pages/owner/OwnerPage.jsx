import { useEffect, useState } from 'react'
import OwnerAllowedEmailForm from '../../components/owner/OwnerAllowedEmailForm'
import OwnerAllowedEmailList from '../../components/owner/OwnerAllowedEmailList'
import OwnerHeader from '../../components/owner/OwnerHeader'
import OwnerStoreDashboard from '../../components/owner/OwnerStoreDashboard'
import { useAuth } from '../../contexts/AuthContext'
import { normalizeOwnerEmail, validateOwnerEmail } from '../../lib/ownerAccess'
import { signOutCurrentUser } from '../../services/authSessionService'
import { loadOwnerDashboardData, updateStoreAdminEmail } from '../../services/ownerDashboardService'
import {
  addOwnerAllowedEmail,
  removeOwnerAllowedEmail,
  subscribeOwnerAllowedEmails,
} from '../../services/ownerAccessService'

export default function OwnerPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('stores')
  const [allowed, setAllowed] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardError, setDashboardError] = useState('')
  const [ownerEmailSavingStoreId, setOwnerEmailSavingStoreId] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => subscribeOwnerAllowedEmails(setAllowed), [])

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

  async function handleAdd(event) {
    event.preventDefault()
    const email = normalizeOwnerEmail(emailInput)
    const validationError = validateOwnerEmail(email)
    if (validationError) {
      setError(validationError)
      return
    }

    setAdding(true)
    setError('')
    try {
      await addOwnerAllowedEmail({ email, addedBy: user?.email ?? null })
      setEmailInput('')
    } catch {
      setError('追加に失敗しました')
    } finally {
      setAdding(false)
    }
  }

  function handleRemove(email) {
    removeOwnerAllowedEmail(email)
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
      setDashboardError(saveError.message || '店舗管理者メールの保存に失敗しました')
    } finally {
      setOwnerEmailSavingStoreId('')
    }
  }

  return (
    <div className="owner-page">
      <OwnerHeader onSignOut={signOutCurrentUser} />
      <main className="owner-content">
        <div className="owner-tabs">
          <button
            type="button"
            onClick={() => setActiveTab('stores')}
            className={`owner-tab${activeTab === 'stores' ? ' is-active' : ''}`}
          >
            店舗一覧
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('emails')}
            className={`owner-tab${activeTab === 'emails' ? ' is-active' : ''}`}
          >
            許可メール
          </button>
        </div>

        {activeTab === 'stores' ? (
          <OwnerStoreDashboard
            dashboard={dashboard}
            error={dashboardError}
            loading={dashboardLoading}
            ownerEmailSavingStoreId={ownerEmailSavingStoreId}
            onOwnerEmailSave={handleStoreAdminEmailSave}
            onRefresh={loadDashboard}
          />
        ) : (
          <>
            <OwnerAllowedEmailForm
              adding={adding}
              emailInput={emailInput}
              error={error}
              onChange={value => {
                setEmailInput(value)
                setError('')
              }}
              onSubmit={handleAdd}
            />
            <OwnerAllowedEmailList
              allowedEmails={allowed}
              onRemove={handleRemove}
            />
          </>
        )}
      </main>
    </div>
  )
}
