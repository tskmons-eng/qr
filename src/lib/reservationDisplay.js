const TOKYO_TIME_ZONE = 'Asia/Tokyo'
const ARRIVAL_NOTICE_LEAD_MINUTES = 10

function getTokyoDateParts(date) {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: TOKYO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  return Object.fromEntries(parts.map(part => [part.type, part.value]))
}

function toReservationTimeValue(time) {
  return String(time || '00:00').slice(0, 5)
}

function toMillis(value) {
  if (!value) return 0
  if (value instanceof Date) return value.getTime()
  if (typeof value.toDate === 'function') return value.toDate().getTime()
  if (typeof value.seconds === 'number') return value.seconds * 1000
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

export function getTokyoDateString(now = new Date()) {
  const parts = getTokyoDateParts(now)
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function buildTokyoReservationDate(date, time) {
  const normalizedTime = toReservationTimeValue(time)
  return new Date(`${date}T${normalizedTime}:00+09:00`)
}

export function buildReservationScheduleFields({ date, time }) {
  const reservationAt = buildTokyoReservationDate(date, time)
  const arrivalNoticeAt = new Date(reservationAt.getTime() - ARRIVAL_NOTICE_LEAD_MINUTES * 60 * 1000)

  return {
    reservationAt,
    arrivalNoticeAt,
    arrivalNoticeStatus: 'pending',
    arrivalNoticeSentAt: null,
    waitingStatus: 'none',
    waitingReason: null,
    seatedTableId: null,
    seatedOrderId: null,
    createdNoticeSentAt: null,
    handledByStaffId: null,
    handledByStaffName: null,
    dismissedAt: null,
  }
}

export function isConfirmedReservation(reservation) {
  return reservation?.status === 'confirmed'
}

export function sortReservationsByTime(reservations) {
  return [...reservations].sort((a, b) => {
    const timeCompare = toReservationTimeValue(a.time).localeCompare(toReservationTimeValue(b.time))
    if (timeCompare !== 0) return timeCompare
    return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ja')
  })
}

export function getTodayReservations(reservations, today = getTokyoDateString()) {
  return sortReservationsByTime(
    reservations.filter(reservation => isConfirmedReservation(reservation) && reservation.date === today)
  )
}

export function getNextReservationForTable(reservations, tableId, today = getTokyoDateString()) {
  return getTodayReservations(reservations, today).find(reservation => reservation.tableId === tableId) ?? null
}

export function getUnassignedTodayReservations(reservations, today = getTokyoDateString()) {
  return getTodayReservations(reservations, today).filter(reservation => !reservation.tableId)
}

export function formatReservationBadge(reservation) {
  if (!reservation) return ''
  return `${toReservationTimeValue(reservation.time)} ${Number(reservation.guestCount ?? 0)}名`
}

export function formatReservationNoticeTitle(reservation) {
  if (!reservation) return ''
  return `${toReservationTimeValue(reservation.time)} ${reservation.name ?? '予約'}様 ${Number(reservation.guestCount ?? 0)}名`
}

export function getReservationWaitingReasonLabel(reason) {
  if (reason === 'table_occupied') return '指定席が使用中です'
  if (reason === 'table_missing') return '指定席が見つかりません'
  if (reason === 'table_unassigned') return '席未指定です'
  if (reason === 'auto_seat_failed') return '自動案内に失敗しました'
  return '案内が必要です'
}

export function readReservationArrivalNoticeMillis(reservation) {
  return toMillis(reservation?.arrivalNoticeAt)
}

export function sortWaitingReservations(reservations) {
  return [...reservations].sort((a, b) => {
    const arrivalCompare = readReservationArrivalNoticeMillis(a) - readReservationArrivalNoticeMillis(b)
    if (arrivalCompare !== 0) return arrivalCompare
    return toReservationTimeValue(a.time).localeCompare(toReservationTimeValue(b.time))
  })
}
