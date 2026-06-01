export default function StaffEntryForm({
  autoEntering,
  code,
  error,
  loading,
  rememberCode,
  onCodeChange,
  onRememberChange,
  onSubmit,
}) {
  const canSubmit = code.length === 6 && !loading

  return (
    <div className="staff-entry">
      <div className="staff-entry__card">
        <h1 className="staff-entry__title">スタッフ画面</h1>
        <p className="staff-entry__description">
          {autoEntering ? '保存済みの店舗コードで入室しています...' : '店舗コードを入力してください'}
        </p>
        <form onSubmit={onSubmit}>
          <input
            value={code}
            onChange={event => onCodeChange(event.target.value)}
            placeholder="XXXXXX"
            autoFocus
            autoCapitalize="characters"
            className="staff-entry__code"
          />

          <label className="staff-entry__remember">
            <input
              type="checkbox"
              checked={rememberCode}
              onChange={event => onRememberChange(event.target.checked)}
            />
            次回から店舗コード入力を省略する
          </label>

          {error && <p className="staff-entry__error">{error}</p>}
          <button
            type="submit"
            disabled={!canSubmit}
            className="staff-entry__submit"
          >
            {loading ? '確認中...' : '入室する'}
          </button>
        </form>
      </div>
    </div>
  )
}
