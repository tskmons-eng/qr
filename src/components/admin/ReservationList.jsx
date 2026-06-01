import { RESERVATION_STATUS_LABEL } from '../../lib/reservationCalendar'

export default function ReservationList({ reservations, tables, onStatusChange }) {
  if (reservations.length === 0) {
    return <div className="reservation-list__empty">予約はありません</div>
  }

  return (
    <div className="reservation-list">
      {reservations.map(reservation => {
        const tableName = tables.find(table => table.id === reservation.tableId)?.tableName

        return (
          <div key={reservation.id} className="reservation-card">
            <div className="reservation-card__main">
              <div>
                <div className="reservation-card__title">
                  <span className="reservation-card__time">{reservation.time}</span>
                  <span>{reservation.name} 様</span>
                  <span className="reservation-card__guest">{reservation.guestCount}名</span>
                </div>
                <div className="reservation-card__meta">
                  {reservation.phone && <span>電話 {reservation.phone}</span>}
                  {tableName && <span>席 {tableName}</span>}
                  {reservation.note && <span>メモ {reservation.note}</span>}
                </div>
              </div>
              <span className={`reservation-card__status is-${reservation.status}`}>
                {RESERVATION_STATUS_LABEL[reservation.status]}
              </span>
            </div>

            {reservation.status === 'confirmed' && (
              <div className="reservation-card__actions">
                <button type="button" className="reservation-card__seat" onClick={() => onStatusChange(reservation.id, 'seated')}>
                  案内済にする
                </button>
                <button type="button" className="reservation-card__cancel" onClick={() => onStatusChange(reservation.id, 'cancelled')}>
                  取消
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
