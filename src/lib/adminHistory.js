export const HISTORY_ACTION_LABELS = {
  checkout: '会計',
  checkout_discount: '割引会計',
  cancel_item: 'キャンセル',
  seat_guests: '着席',
  move_table: '席移動',
  adjust_guests: '人数変更',
  seat_reservation: '予約着席',
  auto_seat_reservation: '予約自動着席',
  sales_attribution: '担当変更',
  sales_assignee: '担当者管理',
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
      targetType: 'check',
      targetId: check.id,
      checkId: check.id,
      actorStaffName: check.closedByStaffName ?? check.closedByEmail ?? '—',
      note: `¥${Number(check.total ?? 0).toLocaleString()} (割引 −¥${Number(check.discountAmount ?? 0).toLocaleString()}${check.discountNote ? ' / ' + check.discountNote : ''})`,
      createdAt: check.completedAt,
      _check: check,
    }))
}

export function sortHistoryItemsByCreatedAt(items) {
  return [...items].sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
}

function getCheckoutActionCheckId(item) {
  if (item.actionType !== 'checkout' && item.actionType !== 'checkout_discount') return null
  if (item.checkId) return item.checkId
  if (item.targetType === 'check' && item.targetId) return item.targetId
  return item._check?.id ?? null
}

function dedupeCheckoutActions(actions) {
  const seenCheckIds = new Set()

  return sortHistoryItemsByCreatedAt(actions).filter(action => {
    const checkId = getCheckoutActionCheckId(action)
    if (!checkId) return true
    if (seenCheckIds.has(checkId)) return false
    seenCheckIds.add(checkId)
    return true
  })
}

function upgradeLegacyDiscountActions(actions, checks) {
  const discountedChecks = new Map(
    checks.filter(check => Number(check.discountAmount ?? 0) > 0).map(check => [check.id, check])
  )
  const supplementalItems = new Map(buildDiscountHistoryItems(checks).map(item => [item.id, item]))

  return actions.map(action => {
    const checkId = getCheckoutActionCheckId(action)
    if (action.actionType !== 'checkout' || !checkId || !discountedChecks.has(checkId)) return action
    const supplemental = supplementalItems.get(checkId)
    return {
      ...action,
      actionType: 'checkout_discount',
      checkId,
      note: supplemental?.note ?? action.note,
      _check: discountedChecks.get(checkId),
    }
  })
}

export function mergeHistoryItems(actions, checks) {
  const dedupedActions = dedupeCheckoutActions(upgradeLegacyDiscountActions(actions, checks))
  const recordedCheckIds = new Set(dedupedActions.map(getCheckoutActionCheckId).filter(Boolean))
  const legacyDiscountItems = buildDiscountHistoryItems(checks)
    .filter(item => !recordedCheckIds.has(getCheckoutActionCheckId(item)))

  return sortHistoryItemsByCreatedAt([...dedupedActions, ...legacyDiscountItems])
}

export function filterHistoryItems(items, filter) {
  return filter === 'all' ? items : items.filter(item => item.actionType === filter)
}

export function getHistoryActionLabel(item) {
  if (item?.actionType === 'sales_attribution') {
    return {
      set: '担当設定',
      change: '担当変更',
      clear: '担当解除',
    }[item.changeType] ?? HISTORY_ACTION_LABELS.sales_attribution
  }

  if (item?.actionType === 'sales_assignee') {
    return {
      create: '担当者追加',
      rename: '担当者名変更',
      deactivate: '担当者無効化',
      reactivate: '担当者再有効化',
    }[item.changeType] ?? HISTORY_ACTION_LABELS.sales_assignee
  }

  return HISTORY_ACTION_LABELS[item?.actionType] ?? item?.actionType ?? '不明'
}

export function buildHistoryExportRows(items, formatTimestamp) {
  const header = ['日時', '種別', 'スタッフ', '内容']
  const rows = items.map(item => [
    formatTimestamp(item.createdAt),
    getHistoryActionLabel(item),
    item.actorStaffName ?? item.actorEmail ?? '',
    item.note ?? '',
  ])
  return [header, ...rows]
}

export function buildHistoryExportFilename(date = new Date()) {
  return `操作ログ_${date.toLocaleDateString('ja-JP').replace(/\//g, '-')}.csv`
}
