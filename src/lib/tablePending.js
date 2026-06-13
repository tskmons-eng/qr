export const TABLE_PENDING_AGGREGATE_VERSION = 1

export const EMPTY_TABLE_PENDING_COUNTS = Object.freeze({
  total: 0,
  drink: 0,
  food: 0,
})

export function getPendingCategoryKey(categoryGroup) {
  if (categoryGroup === 'drink') return 'drink'
  if (categoryGroup === 'food') return 'food'
  return null
}

export function createPendingCounts() {
  return { ...EMPTY_TABLE_PENDING_COUNTS }
}

export function addPendingItemToCounts(counts, item) {
  if (!item?.tableId) return counts
  counts.total += 1
  const categoryKey = getPendingCategoryKey(item.categoryGroup)
  if (categoryKey) counts[categoryKey] += 1
  return counts
}

export function countPendingItems(items) {
  return items.reduce(addPendingItemToCounts, createPendingCounts())
}

export function countPendingItemsByTable(items) {
  return items.reduce((map, item) => {
    if (!item.tableId) return map
    const previous = map[item.tableId] ?? createPendingCounts()
    map[item.tableId] = addPendingItemToCounts(previous, item)
    return map
  }, {})
}

export function hasTablePendingAggregate(table) {
  return table?.pendingAggregateVersion === TABLE_PENDING_AGGREGATE_VERSION
}

export function readTablePendingAggregate(table) {
  return {
    total: Number(table?.pendingAggregateCount ?? 0),
    drink: Number(table?.pendingAggregateDrinkCount ?? 0),
    food: Number(table?.pendingAggregateFoodCount ?? 0),
  }
}

export function readLegacyTablePending(table) {
  return {
    total: Number(table?.pendingCount ?? 0),
    drink: 0,
    food: 0,
  }
}

export function buildEmptyTablePendingAggregateFields() {
  return {
    pendingAggregateVersion: TABLE_PENDING_AGGREGATE_VERSION,
    pendingAggregateCount: 0,
    pendingAggregateDrinkCount: 0,
    pendingAggregateFoodCount: 0,
  }
}

export function tableNeedsPendingFallback(table) {
  return table?.status === 'occupied'
    && !!table.currentOrderId
    && !hasTablePendingAggregate(table)
}

export function tablesNeedPendingFallback(tables) {
  return tables.some(tableNeedsPendingFallback)
}
