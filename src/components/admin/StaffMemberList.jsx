import { STAFF_PERMISSION_PRESETS, getStaffPermissionSummary, getStaffPresetKeyFromPermissions } from '../../lib/staffPermissions'

export default function StaffMemberList({ loading, members, onDelete, onPermissionPresetChange }) {
  if (loading) return <p className="admin-staff__status">読み込み中...</p>
  if (members.length === 0) return <p className="admin-staff__status admin-staff__status--empty">スタッフが登録されていません</p>

  return (
    <div className="admin-staff__list">
      {members.map((member, index) => (
        <div
          key={member.id}
          className={`admin-staff__row${index === members.length - 1 ? ' is-last' : ''}`}
        >
          <div>
            <span className="admin-staff__member-name">{member.name}</span>
            <span className="admin-staff__masked-code">{'●'.repeat(4)}</span>
            <span className="admin-staff__permission-summary">{getStaffPermissionSummary(member.permissions)}</span>
          </div>
          <div className="admin-staff__row-actions">
            <select
              value={getStaffPresetKeyFromPermissions(member.permissions)}
              onChange={event => onPermissionPresetChange(member, event.target.value)}
              className="admin-staff__role-select admin-staff__role-select--row"
            >
              <option value="legacy" disabled>既存設定</option>
              <option value="custom" disabled>個別設定</option>
              {STAFF_PERMISSION_PRESETS.map(preset => (
                <option key={preset.key} value={preset.key}>{preset.label}</option>
              ))}
            </select>
            <details className="admin-staff__row-hint">
              <summary>?</summary>
              <p>{getStaffPermissionSummary(member.permissions)}: 権限プリセットを変更すると、次回スタッフ切替時から表示メニューに反映されます。</p>
            </details>
            <button type="button" onClick={() => onDelete(member.id)} className="admin-staff__delete">
              削除
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
