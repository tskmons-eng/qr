import { useEffect, useState } from 'react'
import AdminSalesModal from './AdminSalesModal'

export default function SalesAssigneeManagerModal({
  assignees,
  error,
  onClose,
  onCreate,
  onUpdate,
  open,
  saving,
  successMessage,
}) {
  const [newName, setNewName] = useState('')
  const [draftNames, setDraftNames] = useState({})

  useEffect(() => {
    setDraftNames(Object.fromEntries(assignees.map(assignee => [assignee.id, assignee.name])))
  }, [assignees])

  async function handleCreate(event) {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    try {
      await onCreate(name)
      setNewName('')
    } catch {
      // Error text is owned by the parent so the same state can be announced once.
    }
  }

  async function handleUpdate(assignee, patch) {
    const name = (patch.name ?? draftNames[assignee.id] ?? assignee.name).trim()
    if (!name) return
    try {
      await onUpdate(assignee, { name, isActive: patch.isActive ?? assignee.isActive !== false })
    } catch {
      // Error text is rendered below.
    }
  }

  return (
    <AdminSalesModal
      busy={saving}
      closeDisabled={saving}
      open={open}
      title="担当者管理"
      onClose={onClose}
    >
      <p className="admin-sales-manager__help">
        会計後に選択する担当者を管理します。過去の集計を残すため、不要になった担当者は削除せず無効化します。
      </p>

      <form className="admin-sales-manager__create" onSubmit={handleCreate}>
        <label className="admin-sales-field__label" htmlFor="new-sales-assignee">担当者を追加</label>
        <div>
          <input
            id="new-sales-assignee"
            type="text"
            value={newName}
            maxLength={80}
            disabled={saving}
            placeholder="担当者名"
            onChange={event => setNewName(event.target.value)}
          />
          <button
            type="submit"
            className="admin-sales-button admin-sales-button--primary"
            disabled={saving || !newName.trim()}
          >
            追加
          </button>
        </div>
      </form>

      {error && <div className="admin-sales-inline-error" role="alert">{error}</div>}
      {successMessage && <div className="admin-sales-inline-success" role="status">{successMessage}</div>}

      <div className="admin-sales-manager__list">
        {assignees.length === 0 ? (
          <div className="admin-sales-state-message">担当者はまだ登録されていません</div>
        ) : assignees.map(assignee => {
          const active = assignee.isActive !== false
          const draftName = draftNames[assignee.id] ?? assignee.name
          const nameChanged = draftName.trim() && draftName.trim() !== assignee.name
          return (
            <div key={assignee.id} className={`admin-sales-manager__row${active ? '' : ' is-inactive'}`}>
              <div className="admin-sales-manager__row-heading">
                <span>{active ? '利用中' : '無効'}</span>
                <button
                  type="button"
                  disabled={saving}
                  className="admin-sales-manager__status-button"
                  onClick={() => handleUpdate(assignee, { name: assignee.name, isActive: !active })}
                >
                  {active ? '無効にする' : '再有効化'}
                </button>
              </div>
              <div className="admin-sales-manager__edit">
                <label className="admin-sales-sr-only" htmlFor={`sales-assignee-${assignee.id}`}>
                  担当者名
                </label>
                <input
                  id={`sales-assignee-${assignee.id}`}
                  type="text"
                  value={draftName}
                  maxLength={80}
                  disabled={saving}
                  onChange={event => setDraftNames(names => ({ ...names, [assignee.id]: event.target.value }))}
                />
                <button
                  type="button"
                  className="admin-sales-button admin-sales-button--secondary"
                  disabled={saving || !nameChanged}
                  onClick={() => handleUpdate(assignee, { name: draftName })}
                >
                  名前を保存
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </AdminSalesModal>
  )
}
