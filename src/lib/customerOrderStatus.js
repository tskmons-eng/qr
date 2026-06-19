export const ORDER_ITEM_STATUS_LABELS = {
  ordered: '準備中',
  served: '提供済み',
  cancelled: 'キャンセル',
}

const CUSTOMER_STATUS_ORDER = {
  ordered: 0,
  served: 1,
  cancelled: 2,
}

const CUSTOMER_STATUS_META = {
  ordered: {
    key: 'ordered',
    label: '準備中',
    sectionTitle: '準備中',
    description: '厨房で確認している注文です',
    tone: 'ordered',
  },
  served: {
    key: 'served',
    label: '提供済み',
    sectionTitle: '提供済み',
    description: 'すでに席へお届けした注文です',
    tone: 'served',
  },
  cancelled: {
    key: 'cancelled',
    label: 'キャンセル',
    sectionTitle: 'キャンセル',
    description: 'スタッフがキャンセルした注文です',
    tone: 'cancelled',
  },
}

function lineTotalOf(item) {
  const value = Number(item?.lineTotal)
  return Number.isFinite(value) ? value : 0
}

function orderedAtSecondsOf(item) {
  return item?.orderedAt?.seconds ?? 0
}

export function normalizeCustomerOrderItemStatus(status) {
  if (status === 'served' || status === 'cancelled') return status
  return 'ordered'
}

export function getCustomerOrderStatusMeta(status, { showServedStatus = true } = {}) {
  const normalizedStatus = normalizeCustomerOrderItemStatus(status)
  if (normalizedStatus === 'served' && !showServedStatus) {
    return {
      ...CUSTOMER_STATUS_META.ordered,
      label: '注文済み',
      sectionTitle: '注文済み',
      description: '注文内容として反映済みです',
    }
  }

  return CUSTOMER_STATUS_META[normalizedStatus]
}

export function sortCustomerOrderItems(items) {
  return [...items].sort((a, b) => {
    const timeDiff = orderedAtSecondsOf(a) - orderedAtSecondsOf(b)
    if (timeDiff !== 0) return timeDiff

    const statusDiff =
      CUSTOMER_STATUS_ORDER[normalizeCustomerOrderItemStatus(a?.itemStatus)] -
      CUSTOMER_STATUS_ORDER[normalizeCustomerOrderItemStatus(b?.itemStatus)]
    if (statusDiff !== 0) return statusDiff

    return String(a?.id ?? '').localeCompare(String(b?.id ?? ''))
  })
}

export function groupCustomerOrderItemsByStatus(items, { showServedStatus = true } = {}) {
  const orderedMeta = getCustomerOrderStatusMeta('ordered', { showServedStatus })
  const sections = new Map([[orderedMeta.key, { ...orderedMeta, items: [] }]])

  if (showServedStatus) {
    sections.set('served', { ...CUSTOMER_STATUS_META.served, items: [] })
  }

  sections.set('cancelled', { ...CUSTOMER_STATUS_META.cancelled, items: [] })

  for (const item of sortCustomerOrderItems(items)) {
    const normalizedStatus = normalizeCustomerOrderItemStatus(item?.itemStatus)
    const sectionKey = normalizedStatus === 'served' && !showServedStatus ? 'ordered' : normalizedStatus
    const meta = getCustomerOrderStatusMeta(normalizedStatus, { showServedStatus })
    const section = sections.get(sectionKey)
    section.items.push({
      ...item,
      customerStatus: meta.key,
      customerStatusLabel: meta.label,
      customerStatusTone: meta.tone,
    })
  }

  return [...sections.values()].filter(section => section.items.length > 0)
}

export function isCustomerOrderRequestReflected(items, clientRequestId) {
  const requestId = String(clientRequestId ?? '').trim()
  if (!requestId) return false
  return items.some(item => item?.clientRequestId === requestId)
}

export function getCustomerOrderSettings(storeConfig) {
  const servedWorkflowEnabled = storeConfig?.servedWorkflowEnabled ?? true
  return {
    servedWorkflowEnabled,
    showServedStatus: servedWorkflowEnabled && (storeConfig?.showServedStatus ?? true),
    showItemPrice: storeConfig?.showItemPrice ?? true,
    allowAdditionalOrders: storeConfig?.allowAdditionalOrders ?? true,
  }
}

export function summarizeOrderItems(items, guestCount = 1) {
  const activeItems = items.filter(item => normalizeCustomerOrderItemStatus(item?.itemStatus) !== 'cancelled')
  const total = activeItems.reduce((sum, item) => sum + lineTotalOf(item), 0)
  const orderedCount = items.filter(item => normalizeCustomerOrderItemStatus(item?.itemStatus) === 'ordered').length
  const servedCount = items.filter(item => normalizeCustomerOrderItemStatus(item?.itemStatus) === 'served').length
  const cancelledCount = items.filter(item => normalizeCustomerOrderItemStatus(item?.itemStatus) === 'cancelled').length
  const perPerson = guestCount > 1 ? Math.ceil(total / guestCount) : null

  return {
    total,
    orderedCount,
    servedCount,
    cancelledCount,
    itemCount: activeItems.length,
    visibleItemCount: items.length,
    guestCount,
    perPerson,
  }
}

export function getCheckoutConfirmMessage(total) {
  return total > 0 ? `現在の合計は¥${total.toLocaleString()}です。スタッフに会計希望を送ります。` : undefined
}
