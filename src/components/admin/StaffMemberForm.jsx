import { STAFF_PERMISSION_DEFINITIONS, STAFF_PERMISSION_PRESETS, getStaffPermissionPreset } from '../../lib/staffPermissions'

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
        <select
          value={permissionPreset}
          onChange={event => onPermissionPresetChange(event.target.value)}
          className="admin-staff__role-select"
        >
          {STAFF_PERMISSION_PRESETS.map(preset => (
            <option key={preset.key} value={preset.key}>{preset.label}</option>
          ))}
        </select>
        <button type="button" onClick={onAdd} disabled={adding} className="admin-staff__add-button">
          追加
        </button>
      </div>
      <details className="admin-staff__permission-hint">
        <summary>この権限でできること</summary>
        <p>{selectedPreset.description}</p>
        <ul>
          {STAFF_PERMISSION_DEFINITIONS.map(definition => (
            <li key={definition.key}>
              <strong>{definition.label}</strong>: {definition.description}
            </li>
          ))}
        </ul>
      </details>
      {error && <p className="admin-staff__error">{error}</p>}
    </div>
  )
}
