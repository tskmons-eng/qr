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

// つまんで並べ替え（商品・席）。動かしたものだけに、前後の間の並び順を付けて1件だけ書く
// （以前は全件を書き直していたので、500件を超えると保存できなかった）。
// 並び順が無いものがある・前後の間が無いときだけ 0, 1, 2… と振り直し、変わった分だけ書く。
export function reorderById(items, dragId, targetId) {
  if (!dragId || !targetId || dragId === targetId) return null

  const from = items.findIndex(item => item.id === dragId)
  const to = items.findIndex(item => item.id === targetId)
  if (from < 0 || to < 0) return null

  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)

  const sortOrder = sortOrderBetween(next[to - 1], next[to + 1])
  if (sortOrder !== null && items.every(item => Number.isFinite(item.sortOrder))) {
    next[to] = { ...moved, sortOrder }
    return { next, updates: [{ id: moved.id, sortOrder }] }
  }

  const reordered = next.map((item, index) => ({ ...item, sortOrder: index }))
  return {
    next: reordered,
    updates: reordered
      .filter((item, index) => next[index].sortOrder !== item.sortOrder)
      .map(item => ({ id: item.id, sortOrder: item.sortOrder })),
  }
}

// 前後の間の並び順。間が無い（同じ値・小数を細かく割りすぎた）ときは null。
function sortOrderBetween(before, after) {
  const low = before?.sortOrder
  const high = after?.sortOrder
  if (before && !Number.isFinite(low)) return null
  if (after && !Number.isFinite(high)) return null
  if (!before && !after) return null
  if (!before) return Math.floor(high) - 1
  if (!after) return Math.floor(low) + 1
  if (high - low < 1e-6) return null
  const middle = Math.floor((low + high) / 2)
  return middle > low && middle < high ? middle : (low + high) / 2
}
