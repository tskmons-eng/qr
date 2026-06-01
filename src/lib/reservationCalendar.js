export const RESERVATION_STATUS_LABEL = {
  confirmed: '予約済',
  cancelled: 'キャンセル',
  seated: '案内済',
}

export const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export function todayStr() {
  return new Date().toLocaleDateString('sv-SE')
}

export function toDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

export function getFirstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay()
}

export function emptyReservationForm(date) {
  return {
    date: date || todayStr(),
    time: '18:00',
    name: '',
    phone: '',
    guestCount: 2,
    tableId: '',
    note: '',
  }
}

export function groupReservationsByDate(reservations) {
  return reservations.reduce((groups, reservation) => {
    if (!groups[reservation.date]) groups[reservation.date] = []
    groups[reservation.date].push(reservation)
    return groups
  }, {})
}

export function getActiveReservationsForDate(reservationsByDate, date) {
  return (reservationsByDate[date] || [])
    .filter(reservation => reservation.status !== 'cancelled')
    .sort((a, b) => a.time.localeCompare(b.time))
}

export function formatReservationDateLabel(date) {
  if (!date) return ''
  return new Date(`${date}T00:00:00`).toLocaleDateString('ja-JP', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}
