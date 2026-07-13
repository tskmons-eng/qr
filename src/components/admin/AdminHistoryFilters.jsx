import { HISTORY_ACTION_LABELS } from '../../lib/adminHistory'

export default function AdminHistoryFilters({ filter, filterKeys, onFilterChange }) {
  return (
    <>
      <label className="admin-history-filter-select">
        <span>表示する操作</span>
        <select value={filter} onChange={event => onFilterChange(event.target.value)}>
          {filterKeys.map(key => (
            <option key={key} value={key}>{key === 'all' ? 'すべて' : HISTORY_ACTION_LABELS[key]}</option>
          ))}
        </select>
      </label>
      <div className="admin-history-filters">
        {filterKeys.map(key => (
          <button
            key={key}
            type="button"
            onClick={() => onFilterChange(key)}
            className={`admin-history-filter${filter === key ? ' is-active' : ''}`}
          >
            {key === 'all' ? 'すべて' : HISTORY_ACTION_LABELS[key]}
          </button>
        ))}
      </div>
    </>
  )
}
