import { formatElapsed, getStaffTableStatusKey, STAFF_TABLE_STATUS } from '../../lib/staffTableList'

export default function StaffTableCard({ table, pending, now, onClick }) {
  const statusKey = getStaffTableStatusKey(table, pending)
  const status = STAFF_TABLE_STATUS[statusKey] ?? STAFF_TABLE_STATUS.vacant
  const otherPending = pending.total - pending.drink - pending.food

  return (
    <button
      type="button"
      onClick={onClick}
      className={`staff-table-list-card staff-table-list-card--${status.tone}`}
    >
      <div className="staff-table-list-card__header">
        <div className="staff-table-list-card__name">{table.tableName}</div>
        {pending.total > 0 && table.status === 'occupied' && (
          <div className="staff-table-list-card__badges">
            {pending.drink > 0 && <span className="staff-table-list-card__badge staff-table-list-card__badge--drink">🥤 {pending.drink}</span>}
            {pending.food > 0 && <span className="staff-table-list-card__badge staff-table-list-card__badge--food">🍽 {pending.food}</span>}
            {otherPending > 0 && <span className="staff-table-list-card__badge staff-table-list-card__badge--other">待 {otherPending}</span>}
          </div>
        )}
      </div>
      <div className="staff-table-list-card__status">{status.label}</div>
      {table.guestCount > 0 && (
        <div className="staff-table-list-card__guest">{table.guestCount}名</div>
      )}
      {table.status !== 'vacant' && table.startedAt?.seconds && (
        <div className="staff-table-list-card__elapsed">
          {formatElapsed(table.startedAt.seconds, now)}
        </div>
      )}
    </button>
  )
}
