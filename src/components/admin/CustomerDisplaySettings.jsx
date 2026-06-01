export default function CustomerDisplaySettings({ toggles, config, onToggle }) {
  return (
    <>
      <h2 className="admin-settings__heading admin-settings__heading--spaced">お客様画面の設定</h2>
      <div className="admin-settings__panel admin-settings__panel--flush">
        {toggles.map((setting, index) => (
          <div
            key={setting.key}
            className={`admin-settings__toggle-row${index === toggles.length - 1 ? ' is-last' : ''}`}
          >
            <div className="admin-settings__toggle-copy">
              <div className="admin-settings__toggle-label">{setting.label}</div>
              <div className="admin-settings__toggle-description">{setting.description}</div>
            </div>
            <button
              type="button"
              onClick={() => onToggle(setting.key)}
              className={`admin-settings__switch${config[setting.key] ? ' is-on' : ''}`}
              aria-pressed={Boolean(config[setting.key])}
            >
              <span className="admin-settings__switch-knob" />
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
