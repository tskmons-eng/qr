import { formatHistoryDate, HISTORY_ACTION_LABELS } from '../../lib/adminHistory'

export default function AdminHistoryList({ items, loading }) {
  if (loading) return <p className="admin-history__status">読み込み中...</p>
  if (items.length === 0) return <p className="admin-history__status admin-history__status--empty">履歴がありません</p>

  return (
    <div className="admin-history-list">
      {items.map(item => (
        <div key={`${item.id}-${item.actionType}`} className="admin-history-row">
          <span className={`admin-history-row__badge admin-history-row__badge--${item.actionType}`}>
            {HISTORY_ACTION_LABELS[item.actionType] ?? item.actionType}
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
