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
      storeName: store.storeName || '店舗名未設定',
      storeCode: store.storeCode || '',
      status: store.isOpen === false ? '停止中' : '稼働中',
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
      activeStoreCount: sortedStores.filter(store => store.status === '稼働中').length,
      todaySales: sortedStores.reduce((sum, store) => sum + store.todaySales, 0),
      todayCheckCount: sortedStores.reduce((sum, store) => sum + store.todayCheckCount, 0),
      openOrderCount: sortedStores.reduce((sum, store) => sum + store.openOrderCount, 0),
    },
  }
}
