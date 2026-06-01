export const KITCHEN_FILTERS = [
  { key: 'all', label: 'すべて' },
  { key: 'drink', label: '🥤 ドリンク' },
  { key: 'food', label: '🍽 フード' },
]

export function formatKitchenElapsed(timestamp, nowMs = Date.now()) {
  if (!timestamp) return ''
  const seconds = Math.floor((nowMs - timestamp.toDate().getTime()) / 1000)
  if (seconds < 60) return `${seconds}秒`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}分`
  return `${Math.floor(minutes / 60)}時間${minutes % 60}分`
}

export function getKitchenWaitLevel(timestamp, nowMs = Date.now()) {
  if (!timestamp) return 'idle'
  const minutes = Math.floor((nowMs - timestamp.toDate().getTime()) / 60000)
  if (minutes >= 15) return 'urgent'
  if (minutes >= 8) return 'warning'
  return 'normal'
}

export function filterKitchenItemsByGroup(items, filterGroup) {
  if (filterGroup === 'all') return items
  return items.filter(item => item.categoryGroup === filterGroup)
}

export function sortKitchenItemsByOrderedAt(items) {
  return [...items].sort((a, b) => (a.orderedAt?.seconds ?? 0) - (b.orderedAt?.seconds ?? 0))
}

export function buildKitchenTableGroups({ tables, pendingItems, filterGroup }) {
  const filteredItems = filterKitchenItemsByGroup(pendingItems, filterGroup)
  const groups = tables
    .filter(table => table.currentOrderId)
    .map(table => {
      const items = sortKitchenItemsByOrderedAt(filteredItems.filter(item => item.orderId === table.currentOrderId))
      return { table, items, oldest: items[0]?.orderedAt ?? null }
    })
    .filter(group => group.items.length > 0)

  return groups.sort((a, b) => (a.oldest?.seconds ?? Infinity) - (b.oldest?.seconds ?? Infinity))
}

export function findNewKitchenItems(items, previousIds, filterGroup) {
  if (previousIds === null) return []
  return filterKitchenItemsByGroup(
    items.filter(item => !previousIds.has(item.id)),
    filterGroup
  )
}
