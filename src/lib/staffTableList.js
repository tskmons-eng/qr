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

// 席一覧の作り直し（2026-10-22）。「対応が要る席」を上に、利用中・空席を下に分ける。読み取りは増やさない。
export const STAFF_TABLE_FILTERS = [
  { key: 'all', label: 'すべて' },
  { key: 'needs', label: '対応待ち' },
  { key: 'occupied', label: '利用中' },
  { key: 'vacant', label: '空席' },
]

function isVacantTable(table) {
  return !table.status || table.status === 'vacant'
}

function describePending(pending) {
  const parts = []
  if (pending.food > 0) parts.push(`フード${pending.food}`)
  if (pending.drink > 0) parts.push(`ドリンク${pending.drink}`)
  return parts.join('・')
}

export function formatAgo(createdAtSeconds, nowMs) {
  if (!createdAtSeconds) return ''
  const minutes = Math.floor((nowMs / 1000 - createdAtSeconds) / 60)
  return minutes < 1 ? 'たった今' : `${minutes}分前`
}

// 1つの席に、呼び出し・会計の依頼・未提供のどれがあるか。古い呼び出しから順に上へ。
export function buildStaffTableBoard({ tables, pendingMap = {}, calls = [] }) {
  const callsByTable = new Map()
  for (const call of calls) {
    if (!call.tableId) continue
    callsByTable.set(call.tableId, [...(callsByTable.get(call.tableId) ?? []), call])
  }

  const needs = []
  const occupied = []
  const vacant = []
  for (const table of tables) {
    const pending = getStaffTablePending(table, pendingMap)
    const tableCalls = callsByTable.get(table.id) ?? []
    const hasPending = !isVacantTable(table) && pending.total > 0
    const entry = { table, pending, hasPending }
    if (tableCalls.length > 0 || hasPending) {
      const oldestCall = tableCalls.reduce((oldest, call) => (
        !oldest || (call.createdAt?.seconds ?? 0) < (oldest.createdAt?.seconds ?? 0) ? call : oldest
      ), null)
      needs.push({
        ...entry,
        calls: tableCalls,
        hasCall: tableCalls.some(call => call.type !== 'checkout'),
        hasCheckoutRequest: tableCalls.some(call => call.type === 'checkout'),
        pendingDetail: describePending(pending),
        oldestCallAt: oldestCall?.createdAt?.seconds ?? null,
      })
    }
    if (isVacantTable(table)) vacant.push(entry)
    else occupied.push(entry)
  }

  // 一覧に出ていない席（別の席グループ・削除済み）の呼び出しも、見落とさないよう行として出す。
  const shownTableIds = new Set(tables.map(table => table.id))
  for (const [tableId, tableCalls] of callsByTable) {
    if (shownTableIds.has(tableId)) continue
    needs.push({
      table: { id: tableId, tableName: tableCalls[0].tableName ?? '' },
      pending: { total: 0, drink: 0, food: 0 },
      hasPending: false,
      calls: tableCalls,
      hasCall: tableCalls.some(call => call.type !== 'checkout'),
      hasCheckoutRequest: tableCalls.some(call => call.type === 'checkout'),
      pendingDetail: '',
      oldestCallAt: Math.min(...tableCalls.map(call => call.createdAt?.seconds ?? 0)) || null,
    })
  }

  // 呼び出しのある席を古い順に先、未提供だけの席は着席の古い順。
  needs.sort((a, b) => {
    if (a.oldestCallAt && b.oldestCallAt) return a.oldestCallAt - b.oldestCallAt
    if (a.oldestCallAt || b.oldestCallAt) return a.oldestCallAt ? -1 : 1
    return (a.table.startedAt?.seconds ?? 0) - (b.table.startedAt?.seconds ?? 0)
  })

  return {
    needs,
    occupied,
    vacant,
    counts: { all: tables.length, needs: needs.length, occupied: occupied.length, vacant: vacant.length },
  }
}
