import {
  countPendingItemsByTable,
  readLegacyTablePending,
  readTablePendingAggregate,
  tableNeedsPendingFallback,
} from './tablePending.js'

export const STAFF_TABLE_STATUS = {
  vacant: { label: '空席', tone: 'vacant' },
  occupied: { label: '使用中', tone: 'occupied' },
  occupied_pending: { label: '使用中', tone: 'occupied-pending' },
  checkout_pending: { label: '会計待ち', tone: 'checkout-pending' },
}

export function formatElapsed(startedAtSeconds, nowMs) {
  const elapsed = Math.floor((nowMs / 1000) - startedAtSeconds)
  if (elapsed < 60) return '1分未満'
  const hours = Math.floor(elapsed / 3600)
  const minutes = Math.floor((elapsed % 3600) / 60)
  if (hours > 0) return `${hours}時間${minutes}分`
  return `${minutes}分`
}

export function countPendingOrderItems(items) {
  return countPendingItemsByTable(items)
}

export function getStaffTablePending(table, fallbackPendingMap = {}) {
  if (tableNeedsPendingFallback(table)) {
    return fallbackPendingMap[table.id] ?? readLegacyTablePending(table)
  }
  return readTablePendingAggregate(table)
}

export function getStaffTableStatusKey(table, pending) {
  if (table.status === 'occupied' && pending.total > 0) return 'occupied_pending'
  return table.status ?? 'vacant'
}
