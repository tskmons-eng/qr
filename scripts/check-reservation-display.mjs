import assert from 'node:assert/strict'
import {
  buildReservationScheduleFields,
  buildTokyoReservationDate,
  formatReservationBadge,
  getNextReservationForTable,
  getReservationWaitingReasonLabel,
  getTodayReservations,
  getTokyoDateString,
  getUnassignedTodayReservations,
  sortWaitingReservations,
} from '../src/lib/reservationDisplay.js'

assert.equal(getTokyoDateString(new Date('2026-06-14T15:30:00.000Z')), '2026-06-15')
assert.equal(buildTokyoReservationDate('2026-06-15', '18:30').toISOString(), '2026-06-15T09:30:00.000Z')

const schedule = buildReservationScheduleFields({ date: '2026-06-15', time: '18:30' })
assert.equal(schedule.reservationAt.toISOString(), '2026-06-15T09:30:00.000Z')
assert.equal(schedule.arrivalNoticeAt.toISOString(), '2026-06-15T09:20:00.000Z')
assert.equal(schedule.arrivalNoticeStatus, 'pending')
assert.equal(schedule.waitingStatus, 'none')

const reservations = [
  { id: 'late', date: '2026-06-15', time: '19:00', status: 'confirmed', tableId: 't1', guestCount: 3, name: 'B' },
  { id: 'cancelled', date: '2026-06-15', time: '17:00', status: 'cancelled', tableId: 't1', guestCount: 2, name: 'X' },
  { id: 'early', date: '2026-06-15', time: '18:00', status: 'confirmed', tableId: 't1', guestCount: 2, name: 'A' },
  { id: 'free', date: '2026-06-15', time: '18:15', status: 'confirmed', tableId: '', guestCount: 4, name: 'C' },
  { id: 'other-day', date: '2026-06-16', time: '18:00', status: 'confirmed', tableId: 't2', guestCount: 2, name: 'D' },
]

assert.deepEqual(getTodayReservations(reservations, '2026-06-15').map(reservation => reservation.id), ['early', 'free', 'late'])
assert.equal(getNextReservationForTable(reservations, 't1', '2026-06-15').id, 'early')
assert.deepEqual(getUnassignedTodayReservations(reservations, '2026-06-15').map(reservation => reservation.id), ['free'])
assert.equal(formatReservationBadge(reservations[0]), '19:00 3名')
assert.equal(getReservationWaitingReasonLabel('table_occupied'), '指定席が使用中です')

assert.deepEqual(sortWaitingReservations([
  { id: 'b', arrivalNoticeAt: { seconds: 20 }, time: '18:00' },
  { id: 'a', arrivalNoticeAt: { seconds: 10 }, time: '19:00' },
]).map(reservation => reservation.id), ['a', 'b'])

console.log('reservation display checks passed')
