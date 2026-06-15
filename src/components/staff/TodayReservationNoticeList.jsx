import {
  formatReservationBadge,
  formatReservationNoticeTitle,
  getReservationWaitingReasonLabel,
} from '../../lib/reservationDisplay'

export default function TodayReservationNoticeList({ reservations, tables = [], tone = 'staff' }) {
  if (!reservations.length) return null

  const tableNameById = new Map(tables.map(table => [table.id, table.tableName]))
  const className = `today-reservations today-reservations--${tone}`

  return (
    <section className={className} aria-label="本日の予約">
      <div className="today-reservations__header">
        <span className="today-reservations__title">予約あり</span>
        <span className="today-reservations__count">{reservations.length}件</span>
      </div>
      <div className="today-reservations__list">
        {reservations.map(reservation => (
          <div key={reservation.id} className="today-reservations__item">
            <span className="today-reservations__main">{formatReservationNoticeTitle(reservation)}</span>
            <span className="today-reservations__meta">
              {reservation.tableId ? `席 ${tableNameById.get(reservation.tableId) ?? '指定あり'}` : '席未指定'}
            </span>
            {reservation.waitingStatus === 'pending' && (
              <span className="today-reservations__wait">
                {getReservationWaitingReasonLabel(reservation.waitingReason)}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export function TableReservationBadge({ reservation }) {
  if (!reservation) return null

  return (
    <div className="table-reservation-badge">
      <span className="table-reservation-badge__label">予約あり</span>
      <span className="table-reservation-badge__value">{formatReservationBadge(reservation)}</span>
    </div>
  )
}
