function bySortOrder(a, b) {
  return a.sortOrder - b.sortOrder
}

export function swapSortOrderById(items, id, direction) {
  const index = items.findIndex(item => item.id === id)
  const targetIndex = index + direction
  if (index < 0 || targetIndex < 0 || targetIndex >= items.length) return null

  const item = items[index]
  const target = items[targetIndex]
  const next = [...items]
  next[index] = { ...item, sortOrder: target.sortOrder }
  next[targetIndex] = { ...target, sortOrder: item.sortOrder }
  next.sort(bySortOrder)

  return {
    next,
    updates: [
      { id: item.id, sortOrder: target.sortOrder },
      { id: target.id, sortOrder: item.sortOrder },
    ],
  }
}

export function reorderById(items, dragId, targetId) {
  if (!dragId || !targetId || dragId === targetId) return null

  const from = items.findIndex(item => item.id === dragId)
  const to = items.findIndex(item => item.id === targetId)
  if (from < 0 || to < 0) return null

  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)

  const reordered = next.map((item, index) => ({ ...item, sortOrder: index }))
  return {
    next: reordered,
    updates: reordered.map(item => ({ id: item.id, sortOrder: item.sortOrder })),
  }
}
