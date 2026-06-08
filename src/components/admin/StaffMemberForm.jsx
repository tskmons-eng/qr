import StaffPermissionHelpButton from './StaffPermissionHelpButton'
import { STAFF_PERMISSION_PRESETS, getStaffPermissionPreset } from '../../lib/staffPermissions'

export default function StaffMemberForm({
  name,
  code,
  permissionPreset,
  adding,
  error,
  onNameChange,
  onCodeChange,
  onPermissionPresetChange,
  onAdd,
}) {
  const selectedPreset = getStaffPermissionPreset(permissionPreset)

  return (
    <div className="admin-staff__panel">
      <div className="admin-staff__section-title">スタッフを追加</div>
      <div className="admin-staff__form">
        <input
          value={name}
          onChange={event => onNameChange(event.target.value)}
          placeholder="名前"
          className="admin-staff__name-input"
        />
        <input
          value={code}
          onChange={event => onCodeChange(event.target.value)}
          placeholder="4桁コード"
          inputMode="numeric"
          className="admin-staff__code-input"
        />
        <div className="admin-staff__role-field">
          <select
            value={permissionPreset}
            onChange={event => onPermissionPresetChange(event.target.value)}
            className="admin-staff__role-select"
          >
            {STAFF_PERMISSION_PRESETS.map(preset => (
              <option key={preset.key} value={preset.key}>{preset.label}</option>
            ))}
          </select>
          <StaffPermissionHelpButton
            permissions={selectedPreset.permissions}
            summary={selectedPreset.description}
            title={`${selectedPreset.label}の範囲`}
          />
        </div>
        <button type="button" onClick={onAdd} disabled={adding} className="admin-staff__add-button">
          追加
        </button>
      </div>
      {error && <p className="admin-staff__error">{error}</p>}
    </div>
  )
}
