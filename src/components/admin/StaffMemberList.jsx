import StaffPermissionHelpButton from './StaffPermissionHelpButton'
import {
  STAFF_PERMISSION_DEFINITIONS,
  STAFF_PERMISSION_PRESETS,
  getStaffPermissionSummary,
  getStaffPresetKeyFromPermissions,
  normalizeStaffMemberPermissions,
} from '../../lib/staffPermissions'

export default function StaffMemberList({
  loading,
  members,
  resetCode,
  resettingMemberId,
  onCancelCodeReset,
  onDelete,
  onPermissionPresetChange,
  onPermissionToggle,
  onResetCodeChange,
  onSaveCodeReset,
  onStartCodeReset,
}) {
  if (loading) return <p className="admin-staff__status">読み込み中...</p>
  if (members.length === 0) return <p className="admin-staff__status admin-staff__status--empty">スタッフが登録されていません</p>

  return (
    <div className="admin-staff__list">
      {members.map((member, index) => {
        const effectivePermissions = normalizeStaffMemberPermissions(member)
        const presetKey = member.permissions
          ? getStaffPresetKeyFromPermissions(effectivePermissions)
          : 'legacy'
        const permissionSummary = member.permissions
          ? getStaffPermissionSummary(effectivePermissions)
          : getStaffPermissionSummary(null)

        return (
          <div
            key={member.id}
            className={`admin-staff__row${index === members.length - 1 ? ' is-last' : ''}`}
          >
            <div className="admin-staff__member">
              <span className="admin-staff__member-name">{member.name}</span>
              <span className="admin-staff__masked-code">{'●'.repeat(4)}</span>
              <span className="admin-staff__permission-summary">{permissionSummary}</span>
              {resettingMemberId === member.id && (
                <div className="admin-staff__reset-row">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={resetCode}
                    onChange={event => onResetCodeChange(event.target.value)}
                    placeholder="新しい4桁"
                    className="admin-staff__reset-input"
                  />
                  <button type="button" onClick={() => onSaveCodeReset(member)} className="admin-staff__reset-save">
                    保存
                  </button>
                  <button type="button" onClick={onCancelCodeReset} className="admin-staff__reset-cancel">
                    戻る
                  </button>
                </div>
              )}
            </div>
            <div className="admin-staff__row-actions">
              <div className="admin-staff__permission-editor">
                <div className="admin-staff__permission-editor-top">
                  <select
                    value={presetKey}
                    onChange={event => onPermissionPresetChange(member, event.target.value)}
                    className="admin-staff__role-select admin-staff__role-select--row"
                  >
                    <option value="legacy" disabled>既存設定</option>
                    <option value="custom" disabled>個別設定</option>
                    {STAFF_PERMISSION_PRESETS.map(preset => (
                      <option key={preset.key} value={preset.key}>{preset.label}</option>
                    ))}
                  </select>
                  <StaffPermissionHelpButton
                    permissions={effectivePermissions}
                    summary={`${member.name}さんの現在の権限です。`}
                    title="権限のヒント"
                  />
                </div>
                <div className="admin-staff__permission-toggles">
                  {STAFF_PERMISSION_DEFINITIONS.map(definition => (
                    <label key={definition.key} className="admin-staff__permission-toggle">
                      <input
                        type="checkbox"
                        checked={effectivePermissions[definition.key]}
                        onChange={event => onPermissionToggle(member, definition.key, event.target.checked)}
                      />
                      <span>{definition.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => onStartCodeReset(member)} className="admin-staff__reset">
                パス変更
              </button>
              <button type="button" onClick={() => onDelete(member.id)} className="admin-staff__delete">
                削除
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
