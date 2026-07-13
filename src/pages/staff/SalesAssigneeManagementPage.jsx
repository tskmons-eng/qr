import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SalesAssigneeManagerModal from '../../components/admin/SalesAssigneeManagerModal'
import { useStaffMember } from '../../contexts/StaffMemberContext'
import { useStore } from '../../contexts/StoreContext'
import {
  createSalesAssignee,
  loadSalesAssignees,
  updateSalesAssignee,
} from '../../services/salesHistoryService'

function sortAssignees(assignees) {
  return [...assignees].sort((a, b) => (
    Number(b.isActive !== false) - Number(a.isActive !== false)
    || String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ja')
  ))
}

function errorMessage(error, fallback) {
  return error?.message || fallback
}

export default function SalesAssigneeManagementPage() {
  const navigate = useNavigate()
  const { storeId } = useStore()
  const { activeStaff } = useStaffMember()
  const [assignees, setAssignees] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      setAssignees(await loadSalesAssignees(storeId))
    } catch (loadFailure) {
      setLoadError(errorMessage(loadFailure, '担当者を取得できませんでした。'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (storeId) load()
  }, [storeId])

  async function handleCreate(name) {
    setSaving(true)
    setError('')
    setSuccessMessage('')
    try {
      const created = await createSalesAssignee({ storeId, name, activeStaff })
      setAssignees(previous => sortAssignees([...previous, created]))
      setSuccessMessage(`担当者「${created.name}」を追加しました。`)
    } catch (saveError) {
      setError(errorMessage(saveError, '担当者を追加できませんでした。'))
      throw saveError
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(assignee, patch) {
    setSaving(true)
    setError('')
    setSuccessMessage('')
    try {
      const updated = await updateSalesAssignee({
        storeId,
        assigneeId: assignee.id,
        name: patch.name,
        isActive: patch.isActive,
        activeStaff,
      })
      setAssignees(previous => sortAssignees(previous.map(item => (
        item.id === assignee.id ? { ...item, ...updated } : item
      ))))
      const nextIsActive = patch.isActive ?? assignee.isActive !== false
      const nextName = patch.name ?? assignee.name
      const activeChanged = (assignee.isActive !== false) !== nextIsActive
      setSuccessMessage(activeChanged
        ? `「${nextName}」を${nextIsActive ? '再有効化' : '無効に'}しました。`
        : `担当者名を「${nextName}」に変更しました。`)
    } catch (saveError) {
      setError(errorMessage(saveError, '担当者を更新できませんでした。'))
      throw saveError
    } finally {
      setSaving(false)
    }
  }

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
        assignees={assignees}
        error={error}
        open
        saving={saving}
        successMessage={successMessage}
        onClose={() => navigate('/staff')}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />
    </div>
  )
}
