export default function RemainingHeader({ remainingCount, servedCount, tableName, onBack }) {
  return (
    <header className="staff-remaining-header">
      <button type="button" onClick={onBack} className="staff-remaining-header__back">←</button>
      <div className="staff-remaining-header__main">
        <div className="staff-remaining-header__title">{tableName} の残り</div>
        <div className="staff-remaining-header__meta">
          未提供 {remainingCount}点 / 提供済み {servedCount}点
        </div>
      </div>
    </header>
  )
}
