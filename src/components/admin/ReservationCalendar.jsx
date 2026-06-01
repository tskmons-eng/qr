import { toDateStr, WEEKDAYS } from '../../lib/reservationCalendar'

function dayClassName({ isSelected, isToday, isPast, dow }) {
  return [
    'reservation-calendar__day',
    isSelected ? 'is-selected' : '',
    isToday ? 'is-today' : '',
    isPast ? 'is-past' : '',
    dow === 0 ? 'is-sunday' : '',
    dow === 6 ? 'is-saturday' : '',
  ].filter(Boolean).join(' ')
}

export default function ReservationCalendar({
  viewYear,
  viewMonth,
  daysInMonth,
  firstDow,
  reservationsByDate,
  selectedDate,
  todayISO,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
}) {
  return (
    <div className="reservation-calendar">
      <div className="reservation-calendar__nav">
        <button type="button" onClick={onPrevMonth}>‹</button>
        <span>{viewYear}年{viewMonth + 1}月</span>
        <button type="button" onClick={onNextMonth}>›</button>
      </div>

      <div className="reservation-calendar__grid">
        {WEEKDAYS.map((day, index) => (
          <div
            key={day}
            className={`reservation-calendar__weekday${index === 0 ? ' is-sunday' : ''}${index === 6 ? ' is-saturday' : ''}`}
          >
            {day}
          </div>
        ))}

        {Array.from({ length: firstDow }).map((_, index) => (
          <div key={`empty-${index}`} />
        ))}

        {Array.from({ length: daysInMonth }, (_, index) => index + 1).map(day => {
          const dateStr = toDateStr(viewYear, viewMonth, day)
          const dayReservations = (reservationsByDate[dateStr] || []).filter(reservation => reservation.status !== 'cancelled')
          const isToday = dateStr === todayISO
          const isSelected = dateStr === selectedDate
          const isPast = dateStr < todayISO
          const dow = (firstDow + day - 1) % 7

          return (
            <button
              key={day}
              type="button"
              className={dayClassName({ isSelected, isToday, isPast, dow })}
              onClick={() => onSelectDate(dateStr)}
            >
              <span className="reservation-calendar__day-number">{day}</span>
              {dayReservations.length > 0 && (
                <span className="reservation-calendar__day-detail">
                  <span className="reservation-calendar__count">{dayReservations.length}件</span>
                  {dayReservations.slice(0, 2).map(reservation => (
                    <span key={reservation.id} className="reservation-calendar__reservation">
                      {reservation.time} {reservation.name}
                    </span>
                  ))}
                  {dayReservations.length > 2 && (
                    <span className="reservation-calendar__more">+{dayReservations.length - 2}</span>
                  )}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
