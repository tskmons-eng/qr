import { TABLE_STATUS_LABELS } from '../../lib/adminTable'

export default function AdminTableRow({
  table,
  editing,
  editingTableName,
  groups,
  savingTableName,
  onStartEdit,
  onEditingNameChange,
  onSaveName,
  onCancelEdit,
  onGroupChange,
  onShowQr,
}) {
  return (
    <div className="admin-table-row">
      <div className="admin-table-main">
        {editing ? (
          <div className="admin-table-edit-row">
            <input
              value={editingTableName}
              onChange={event => onEditingNameChange(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') onSaveName(table)
                if (event.key === 'Escape') onCancelEdit()
              }}
              autoFocus
              className="admin-table-edit-input"
            />
            <button
              type="button"
              onClick={() => onSaveName(table)}
              disabled={savingTableName}
              className="button button-primary admin-table-edit-button"
            >
              保存
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="button button-secondary admin-table-edit-button"
            >
              戻る
            </button>
          </div>
        ) : (
          <div className="admin-table-name">{table.tableName}</div>
        )}
        <div className={`admin-table-status ${table.status === 'vacant' ? 'is-vacant' : 'is-active'}`}>
          {TABLE_STATUS_LABELS[table.status] ?? table.status}
          {table.guestCount > 0 && ` · ${table.guestCount}名`}
        </div>
        <select
          value={table.groupId ?? ''}
          onChange={event => onGroupChange(table.id, event.target.value)}
          className="admin-table-group-select"
        >
          <option value="">グループ未設定</option>
          {groups.map(group => (
            <option key={group.id} value={group.id}>{group.name}</option>
          ))}
        </select>
      </div>
      {!editing && (
        <div className="admin-table-actions">
          <button
            type="button"
            onClick={() => onStartEdit(table)}
            className="button button-secondary admin-table-action"
          >
            名前変更
          </button>
          <button
            type="button"
            onClick={() => onShowQr(table)}
            className="button button-secondary admin-table-action admin-table-action-wide"
          >
            QR表示
          </button>
        </div>
      )}
    </div>
  )
}
