import { HISTORY_ACTION_LABELS } from '../../lib/adminHistory'

export default function AdminHistoryFilters({ filter, filterKeys, onFilterChange }) {
  return (
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
  )
}
