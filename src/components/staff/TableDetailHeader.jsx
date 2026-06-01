function formatElapsed(startedAtSeconds, nowMs) {
  const elapsed = Math.floor((nowMs / 1000) - startedAtSeconds)
  if (elapsed < 60) return '1分未満'
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  if (h > 0) return `${h}時間${m}分`
  return `${m}分`
}

export default function TableDetailHeader({
  tableName,
  hasOrder,
  guestCount,
  startedAtSeconds,
  nowMs,
  editingGuests,
  guestInput,
  onBack,
  onStartEditGuests,
  onGuestInputChange,
  onGuestStep,
  onSaveGuests,
  onCancelEditGuests,
}) {
  return (
    <header className="staff-table-header">
      <button type="button" onClick={onBack} className="staff-table-back-button">←</button>
      <div className="staff-table-header-main">
        <div className="staff-table-name">{tableName}</div>
        {hasOrder && (
          editingGuests ? (
            <div className="staff-table-guest-edit-row">
              <button type="button" onClick={() => onGuestStep(-1)} className="staff-table-guest-step">−</button>
              <input
                type="number"
                value={guestInput}
                onChange={event => onGuestInputChange(event.target.value)}
                className="staff-table-guest-input"
              />
              <span className="staff-table-guest-unit">名</span>
              <button type="button" onClick={() => onGuestStep(1)} className="staff-table-guest-step">+</button>
              <button type="button" onClick={onSaveGuests} className="staff-table-guest-save">保存</button>
              <button type="button" onClick={onCancelEditGuests} className="staff-table-guest-cancel">戻る</button>
            </div>
          ) : (
            <div className="staff-table-guest-row">
              <span className="staff-table-guest-count">{guestCount}名</span>
              {startedAtSeconds && (
                <span className="staff-table-elapsed">· {formatElapsed(startedAtSeconds, nowMs)}</span>
              )}
              <button type="button" onClick={onStartEditGuests} className="staff-table-guest-change">変更</button>
            </div>
          )
        )}
      </div>
    </header>
  )
}
