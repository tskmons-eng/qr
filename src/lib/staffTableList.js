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
  return items.reduce((map, item) => {
    if (!item.tableId) return map
    const previous = map[item.tableId] ?? { total: 0, drink: 0, food: 0 }
    map[item.tableId] = {
      total: previous.total + 1,
      drink: previous.drink + (item.categoryGroup === 'drink' ? 1 : 0),
      food: previous.food + (item.categoryGroup === 'food' ? 1 : 0),
    }
    return map
  }, {})
}

export function getStaffTableStatusKey(table, pending) {
  if (table.status === 'occupied' && pending.total > 0) return 'occupied_pending'
  return table.status ?? 'vacant'
}
