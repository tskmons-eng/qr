import { formatHistoryDate, getHistoryActionLabel } from '../../lib/adminHistory'

export default function AdminHistoryList({ emptyMessage, error, items, loading, onRetry }) {
  if (loading) {
    return (
      <p className="admin-history__status" role="status">
        操作ログを読み込んでいます...
      </p>
    )
  }

  if (error) {
    return (
      <div className="admin-history__status admin-history__status--error" role="alert">
        <p>{error}</p>
        <button type="button" className="admin-history__retry" onClick={onRetry}>
          再試行
        </button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <p className="admin-history__status admin-history__status--empty">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className="admin-history-list">
      {items.map(item => (
        <div key={`${item.id}-${item.actionType}`} className="admin-history-row">
          <span className={`admin-history-row__badge admin-history-row__badge--${item.actionType}`}>
            {getHistoryActionLabel(item)}
          </span>
          <div className="admin-history-row__main">
            <div className="admin-history-row__note">{item.note ?? '—'}</div>
            <div className="admin-history-row__actor">{item.actorStaffName ?? item.actorEmail ?? '—'}</div>
          </div>
          <span className="admin-history-row__date">{formatHistoryDate(item.createdAt)}</span>
        </div>
      ))}
    </div>
  )
}
