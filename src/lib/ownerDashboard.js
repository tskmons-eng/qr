import { normalizeStoreName } from './storeIdentity.js'

export function ownerDateFromTimestamp(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value.toDate === 'function') return value.toDate()
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000)
  return null
}

export function getOwnerBusinessDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function isOwnerSameBusinessDay(value, date = new Date()) {
  const target = ownerDateFromTimestamp(value)
  if (!target) return false
  return (
    target.getFullYear() === date.getFullYear() &&
    target.getMonth() === date.getMonth() &&
    target.getDate() === date.getDate()
  )
}

export function formatOwnerDateTime(value) {
  const date = ownerDateFromTimestamp(value)
  return date ? date.toLocaleString('ja-JP') : ''
}

export function formatOwnerCurrency(value) {
  return `¥${Math.max(0, Number(value) || 0).toLocaleString()}`
}

function latestTimestamp(values) {
  return values.reduce((latest, value) => {
    const date = ownerDateFromTimestamp(value)
    if (!date) return latest
    if (!latest || date.getTime() > latest.getTime()) return date
    return latest
  }, null)
}

function groupByStoreId(rows) {
  return rows.reduce((map, row) => {
    if (!row.storeId) return map
    const current = map.get(row.storeId) ?? []
    current.push(row)
    map.set(row.storeId, current)
    return map
  }, new Map())
}

export function buildOwnerDashboardSnapshot({ stores, checks, orders }, date = new Date()) {
  const checksByStore = groupByStoreId(checks)
  const ordersByStore = groupByStoreId(orders)
  const storeRows = stores.map(store => {
    const storeChecks = checksByStore.get(store.id) ?? []
    const completedChecks = storeChecks.filter(check => check.status === 'completed')
    const todayChecks = completedChecks.filter(check => isOwnerSameBusinessDay(check.completedAt, date))
    const storeOrders = ordersByStore.get(store.id) ?? []
    const openOrders = storeOrders.filter(order => order.status !== 'checked_out' && order.status !== 'cancelled')
    const lastActivityAt = latestTimestamp([
      store.updatedAt,
      store.createdAt,
      ...completedChecks.map(check => check.completedAt),
      ...storeOrders.map(order => order.updatedAt),
      ...storeOrders.map(order => order.openedAt),
      ...storeOrders.map(order => order.checkedOutAt),
    ])

    const todaySales = todayChecks.reduce((sum, check) => sum + (Number(check.total) || 0), 0)
    const allTimeSales = completedChecks.reduce((sum, check) => sum + (Number(check.total) || 0), 0)

    return {
      id: store.id,
      storeName: normalizeStoreName(store.storeName),
      storeCode: store.storeCode || '',
      ownerEmail: store.ownerEmail || '',
      managerInviteExpiresAtMs: Number(store.managerInviteExpiresAtMs) || 0,
      // 運営者が「店舗を追加」で作った店か（以前の形の店は、店の ID がオーナーの Google アカウント）。
      createdByOperator: Boolean(store.createdBy),
      createdAt: store.createdAt,
      lastActivityAt,
      todaySales,
      todayCheckCount: todayChecks.length,
      completedCheckCount: completedChecks.length,
      openOrderCount: openOrders.length,
      allTimeSales,
    }
  })

  const sortedStores = [...storeRows].sort((a, b) => {
    const byActivity = (ownerDateFromTimestamp(b.lastActivityAt)?.getTime() ?? 0) - (ownerDateFromTimestamp(a.lastActivityAt)?.getTime() ?? 0)
    if (byActivity !== 0) return byActivity
    return a.storeName.localeCompare(b.storeName, 'ja')
  })

  return {
    businessDate: getOwnerBusinessDate(date),
    stores: sortedStores,
    summary: {
      storeCount: sortedStores.length,
      todaySales: sortedStores.reduce((sum, store) => sum + store.todaySales, 0),
      todayCheckCount: sortedStores.reduce((sum, store) => sum + store.todayCheckCount, 0),
      openOrderCount: sortedStores.reduce((sum, store) => sum + store.openOrderCount, 0),
    },
  }
}

// 店長の状態（2026-10-22 店舗登録）：店長メールがあれば「店長」、無ければ招待の残り日数か「店長なし」。
export function describeOwnerStoreManager(store, nowMs = Date.now()) {
  if (store.ownerEmail) return { state: 'assigned', label: store.ownerEmail }
  if (store.managerInviteExpiresAtMs > nowMs) {
    const days = Math.max(1, Math.ceil((store.managerInviteExpiresAtMs - nowMs) / (24 * 60 * 60 * 1000)))
    return { state: 'invited', label: `店長：招待中（あと${days}日）` }
  }
  if (store.createdByOperator === false) return { state: 'assigned', label: '店長：最初のオーナー（Google）' }
  return { state: 'none', label: '店長：まだいません' }
}
