export default function SettingsSaveButton({ saving, saved, onSave }) {
  return (
    <button
      type="button"
      onClick={onSave}
      disabled={saving}
      className={`admin-settings__save${saved ? ' is-saved' : ''}`}
    >
      {saving ? '保存中...' : saved ? '保存しました' : '保存する'}
    </button>
  )
}
