import { useEffect, useState } from 'react'
import {
  formatReservationNoticeTitle,
  getReservationWaitingReasonLabel,
} from '../../lib/reservationDisplay'

function getTableStatusLabel(table) {
  if (!table) return ''
  if (table.status === 'vacant') return '空席'
  if (table.status === 'checkout_pending') return '会計待ち'
  return '使用中'
}

export default function StaffReservationWaitBanner({
  reservations,
  tables,
  onDismiss,
  onOpenTable,
  onSeat,
}) {
  const [selectedTableIds, setSelectedTableIds] = useState({})

  useEffect(() => {
    setSelectedTableIds(prev => {
      const next = { ...prev }
      reservations.forEach(reservation => {
        if (!next[reservation.id]) next[reservation.id] = reservation.tableId || ''
      })
      Object.keys(next).forEach(id => {
        if (!reservations.some(reservation => reservation.id === id)) delete next[id]
      })
      return next
    })
  }, [reservations])

  if (!reservations.length) return null

  const tableById = new Map(tables.map(table => [table.id, table]))

  return (
    <div className="staff-reservation-wait-banner">
      {reservations.map(reservation => {
        const plannedTable = tableById.get(reservation.tableId)
        const selectedTableId = selectedTableIds[reservation.id] ?? ''

        return (
          <div key={reservation.id} className="staff-reservation-wait-banner__item">
            <div className="staff-reservation-wait-banner__main">
              <span className="staff-reservation-wait-banner__icon">予約</span>
              <div className="staff-reservation-wait-banner__copy">
                <div className="staff-reservation-wait-banner__title">予約のお客様が待っています</div>
                <div className="staff-reservation-wait-banner__detail">
                  {formatReservationNoticeTitle(reservation)}
                </div>
                <div className="staff-reservation-wait-banner__reason">
                  {getReservationWaitingReasonLabel(reservation.waitingReason)}
                  {plannedTable && ` / 指定席 ${plannedTable.tableName}`}
                </div>
              </div>
            </div>
            <div className="staff-reservation-wait-banner__actions">
              {plannedTable && plannedTable.status !== 'vacant' && (
                <button
                  type="button"
                  className="staff-reservation-wait-banner__button"
                  onClick={() => onOpenTable(plannedTable.id)}
                >
                  席を開ける
                </button>
              )}
              <select
                value={selectedTableId}
                className="staff-reservation-wait-banner__select"
                onChange={event => setSelectedTableIds(prev => ({ ...prev, [reservation.id]: event.target.value }))}
              >
                <option value="">席を選択</option>
                {tables.map(table => (
                  <option key={table.id} value={table.id}>
                    {table.tableName}（{getTableStatusLabel(table)}）
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="staff-reservation-wait-banner__button staff-reservation-wait-banner__button--seat"
                disabled={!selectedTableId}
                onClick={() => onSeat(reservation, selectedTableId)}
              >
                この席へ案内
              </button>
              <button
                type="button"
                className="staff-reservation-wait-banner__button staff-reservation-wait-banner__button--dismiss"
                onClick={() => onDismiss(reservation)}
              >
                通知を消す
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
