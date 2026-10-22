import { formatAgo, formatElapsed } from '../../lib/staffTableList'
import { TableReservationBadge } from './TodayReservationNoticeList'

// 席一覧の部品（2026-10-22 作り直し。余白少なめ）。
// 対応が要る席：1行。呼び出し・会計の依頼・未提供を短く並べる。
export function StaffTableNeedRow({ need, now, onClick }) {
  const { table, pending, hasCall, hasCheckoutRequest, pendingDetail, oldestCallAt } = need
  const tone = hasCall ? 'call' : hasCheckoutRequest ? 'checkout' : 'pending'
  const title = [
    hasCall && '呼び出し',
    hasCheckoutRequest && '会計の依頼',
    need.hasPending && `未提供 ${pending.total}品`,
  ].filter(Boolean).join('・')
  const detail = [oldestCallAt && formatAgo(oldestCallAt, now), need.hasPending && pendingDetail].filter(Boolean).join('　')

  return (
    <button type="button" onClick={onClick} className={`staff-table-need staff-table-need--${tone}`}>
      <span className="staff-table-need__name">{table.tableName}</span>
      <span className="staff-table-need__title">
        {title}
        {detail && <span className="staff-table-need__detail">{detail}</span>}
      </span>
      {hasCall && <span className="staff-table-need__tag staff-table-need__tag--call">呼出</span>}
      {hasCheckoutRequest && <span className="staff-table-need__tag">会計</span>}
      {need.hasPending && !hasCall && !hasCheckoutRequest && <span className="staff-table-need__tag">未提供</span>}
    </button>
  )
}

// 利用中の席：3列の小さなカード。未提供があれば下線の色で分かる。
export default function StaffTableCard({ table, pending, reservation, now, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`staff-table-card${pending.total > 0 ? ' has-pending' : ''}`}
    >
      <span className="staff-table-card__row">
        <span className="staff-table-card__name">{table.tableName}</span>
        {table.startedAt?.seconds && (
          <span className="staff-table-card__elapsed">{formatElapsed(table.startedAt.seconds, now)}</span>
        )}
      </span>
      <span className="staff-table-card__row staff-table-card__row--sub">
        <span>{table.guestCount > 0 ? `${table.guestCount}名` : ''}</span>
        {pending.total > 0 && <span className="staff-table-card__pending">未提供 {pending.total}</span>}
      </span>
      <TableReservationBadge reservation={reservation} />
    </button>
  )
}

// 空席：小さなマス。押すと席詳細（着席の画面）へ。
export function StaffVacantTableCell({ table, reservation, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`staff-table-vacant${reservation ? ' has-reservation' : ''}`}>
      {table.tableName}
      {reservation && <span className="staff-table-vacant__reserved">予約</span>}
    </button>
  )
}
