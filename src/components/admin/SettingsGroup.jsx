const SCOPE_LABELS = {
  store: 'お店全体',
  device: 'この端末だけ',
}

const STATUS_MESSAGES = {
  saving: '保存中…',
  saved: '保存しました',
  error: '保存できませんでした。通信を確かめて、もう一度押してください（元の状態に戻しました）',
}

// 設定画面の塊（店舗情報／お客様の注文／お店の運用／この端末だけの設定）。
export default function SettingsGroup({ title, scope = 'store', lead, children }) {
  return (
    <section className="settings-group">
      <div className="settings-group__head">
        <h2 className="settings-group__title">{title}</h2>
        <span className={`settings-group__scope${scope === 'device' ? ' is-device' : ''}`}>{SCOPE_LABELS[scope]}</span>
      </div>
      {lead && <p className="settings-group__lead">{lead}</p>}
      {children}
    </section>
  )
}

export function SettingSaveStatus({ status }) {
  return (
    <span className={`settings-row-status${status ? ` is-${status}` : ''}`} role={status === 'error' ? 'alert' : 'status'}>
      {status ? STATUS_MESSAGES[status] : ''}
    </span>
  )
}

export function SettingToggleRow({ label, description, on, disabled = false, dependencyNote, status, isLast = false, onToggle }) {
  return (
    <div className={`admin-settings__toggle-row${isLast ? ' is-last' : ''}${disabled ? ' is-disabled' : ''}`}>
      <div className="admin-settings__toggle-copy">
        <div className="admin-settings__toggle-label">{label}</div>
        <div className="admin-settings__toggle-description">{description}</div>
        {disabled && dependencyNote && <div className="settings-dependency">{dependencyNote}</div>}
        <SettingSaveStatus status={status} />
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={`admin-settings__switch${on ? ' is-on' : ''}`}
        aria-pressed={Boolean(on)}
        aria-label={label}
      >
        <span className="admin-settings__switch-knob" />
      </button>
    </div>
  )
}
