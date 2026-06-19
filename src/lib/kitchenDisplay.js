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

export function formatKitchenOrderOptions(optionSelections) {
  if (!Array.isArray(optionSelections) || optionSelections.length === 0) return null
  const labels = optionSelections
    .map(option => {
      const groupName = String(option?.groupName ?? '').trim()
      const choice = String(option?.choice ?? '').trim()
      if (!choice) return ''
      return groupName ? `${groupName}: ${choice}` : choice
    })
    .filter(Boolean)

  return labels.length > 0 ? labels.join(' · ') : null
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

export function addOptimisticHiddenKitchenItemIds(currentIds, itemIds) {
  const nextIds = new Set(currentIds)
  let changed = false

  for (const itemId of itemIds) {
    if (!itemId || nextIds.has(itemId)) continue
    nextIds.add(itemId)
    changed = true
  }

  return changed ? nextIds : currentIds
}

export function removeOptimisticHiddenKitchenItemIds(currentIds, itemIds) {
  const nextIds = new Set(currentIds)
  let changed = false

  for (const itemId of itemIds) {
    if (!nextIds.has(itemId)) continue
    nextIds.delete(itemId)
    changed = true
  }

  return changed ? nextIds : currentIds
}

export function filterOptimisticHiddenKitchenItems(items, hiddenItemIds) {
  if (hiddenItemIds.size === 0) return items
  return items.filter(item => !hiddenItemIds.has(item.id))
}

export function pruneOptimisticHiddenKitchenItemIds(currentIds, pendingItems) {
  if (currentIds.size === 0) return currentIds

  const pendingItemIds = new Set(pendingItems.map(item => item.id))
  const nextIds = new Set()
  let changed = false

  for (const itemId of currentIds) {
    if (pendingItemIds.has(itemId)) {
      nextIds.add(itemId)
    } else {
      changed = true
    }
  }

  return changed ? nextIds : currentIds
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
