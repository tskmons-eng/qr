import { useId, useState } from 'react'
import { STAFF_PERMISSION_DEFINITIONS, normalizeStaffPermissions } from '../../lib/staffPermissions'

export default function StaffPermissionHelpButton({
  className = '',
  permissions,
  summary,
  title = '権限のヒント',
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const normalized = normalizeStaffPermissions(permissions, {})

  return (
    <div className={`admin-staff__help${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="admin-staff__help-button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(value => !value)}
        title="権限の説明"
      >
        ?
      </button>
      {open && (
        <div id={panelId} className="admin-staff__help-panel" role="dialog" aria-label={title}>
          <div className="admin-staff__help-title">{title}</div>
          {summary && <p className="admin-staff__help-summary">{summary}</p>}
          <ul className="admin-staff__help-list">
            {STAFF_PERMISSION_DEFINITIONS.map(definition => (
              <li
                key={definition.key}
                className={`admin-staff__help-item${normalized[definition.key] ? ' is-enabled' : ''}`}
              >
                <span className="admin-staff__help-item-label">{definition.label}</span>
                <span className="admin-staff__help-item-status">
                  {normalized[definition.key] ? 'ON' : 'OFF'}
                </span>
                <span className="admin-staff__help-item-text">{definition.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
