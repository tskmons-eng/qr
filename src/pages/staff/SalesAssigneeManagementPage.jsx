import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SalesAssigneeManagerModal from '../../components/admin/SalesAssigneeManagerModal'
import { useStaffMember } from '../../contexts/StaffMemberContext'
import { useStore } from '../../contexts/StoreContext'
import useSalesAssigneeManager from '../../hooks/useSalesAssigneeManager'
import { loadSalesAssignees } from '../../services/salesHistoryService'

// レジ締めの権限が無く、スタッフ権限管理だけがある人のための入口。処理は売上画面と共通。
export default function SalesAssigneeManagementPage() {
  const navigate = useNavigate()
  const { storeId } = useStore()
  const { activeStaff } = useStaffMember()
  const [assignees, setAssignees] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const assigneeManager = useSalesAssigneeManager({ storeId, activeStaff, setAssignees })

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      setAssignees(await loadSalesAssignees(storeId))
    } catch (loadFailure) {
      setLoadError(loadFailure?.message || '担当者を取得できませんでした。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (storeId) load()
  }, [storeId])

  if (loading) {
    return <div className="admin-sales-state-card" role="status">担当者を読み込み中…</div>
  }

  if (loadError) {
    return (
      <div className="admin-sales-state-card is-error" role="alert">
        <strong>担当者を取得できませんでした</strong>
        <span>{loadError}</span>
        <button type="button" onClick={load}>再試行</button>
      </div>
    )
  }

  return (
    <div className="admin-sales">
      <SalesAssigneeManagerModal
        {...assigneeManager.modalProps}
        assignees={assignees}
        open
        onClose={() => navigate('/staff')}
      />
    </div>
  )
}
