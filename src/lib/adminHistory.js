export const HISTORY_ACTION_LABELS = {
  checkout: '会計',
  checkout_discount: '割引会計',
  cancel_item: 'キャンセル',
  seat_guests: '着席',
  move_table: '席移動',
  adjust_guests: '人数変更',
}

export const HISTORY_FILTER_KEYS = ['all', ...Object.keys(HISTORY_ACTION_LABELS)]

export function formatHistoryDate(timestamp) {
  if (!timestamp) return '—'
  return timestamp.toDate?.().toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) ?? '—'
}

export function buildDiscountHistoryItems(checks) {
  return checks
    .filter(check => check.discountAmount > 0)
    .map(check => ({
      id: check.id,
      actionType: 'checkout_discount',
      actorStaffName: check.closedByStaffName ?? check.closedByEmail ?? '—',
      note: `¥${check.total.toLocaleString()} (割引 −¥${check.discountAmount.toLocaleString()}${check.discountNote ? ' / ' + check.discountNote : ''})`,
      createdAt: check.completedAt,
      _check: check,
    }))
}

export function sortHistoryItemsByCreatedAt(items) {
  return [...items].sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
}

export function mergeHistoryItems(actions, checks) {
  return sortHistoryItemsByCreatedAt([...actions, ...buildDiscountHistoryItems(checks)])
}

export function filterHistoryItems(items, filter) {
  return filter === 'all' ? items : items.filter(item => item.actionType === filter)
}

export function buildHistoryExportRows(items, formatTimestamp) {
  const header = ['日時', '種別', 'スタッフ', '内容']
  const rows = items.map(item => [
    formatTimestamp(item.createdAt),
    HISTORY_ACTION_LABELS[item.actionType] ?? item.actionType,
    item.actorStaffName ?? item.actorEmail ?? '',
    item.note ?? '',
  ])
  return [header, ...rows]
}

export function buildHistoryExportFilename(date = new Date()) {
  return `操作履歴_${date.toLocaleDateString('ja-JP').replace(/\//g, '-')}.csv`
}
