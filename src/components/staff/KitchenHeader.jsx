export default function KitchenHeader({
  currentTime,
  filterGroup,
  filters,
  pendingCount,
  onBack,
  onFilterChange,
  onToggleSound,
}) {
  return (
    <header className="staff-kitchen-header">
      <div className="staff-kitchen-header__main">
        <div className="staff-kitchen-header__left">
          <button type="button" onClick={onBack} className="staff-kitchen-header__back">
            ← 戻る
          </button>
          <div>
            <span className="staff-kitchen-header__title">キッチン</span>
            <span className="staff-kitchen-header__count">未提供: {pendingCount}品</span>
          </div>
        </div>
        <div className="staff-kitchen-header__right">
          <span className="staff-kitchen-header__time">{currentTime}</span>
          <button type="button" onClick={onToggleSound} className="staff-kitchen-header__sound">
            🔔
          </button>
        </div>
      </div>
      <div className="staff-kitchen-filters">
        {filters.map(filter => (
          <button
            key={filter.key}
            type="button"
            onClick={() => onFilterChange(filter.key)}
            className={[
              'staff-kitchen-filter',
              `staff-kitchen-filter--${filter.key}`,
              filterGroup === filter.key ? 'is-active' : '',
            ].join(' ')}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </header>
  )
}
