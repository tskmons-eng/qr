export const ORDER_ITEM_STATUS_LABELS = {
  ordered: '準備中',
  served: '提供済み',
  cancelled: 'キャンセル',
}

export function getCustomerOrderSettings(storeConfig) {
  return {
    showServedStatus: storeConfig?.showServedStatus ?? true,
    showItemPrice: storeConfig?.showItemPrice ?? true,
    allowAdditionalOrders: storeConfig?.allowAdditionalOrders ?? true,
  }
}

export function summarizeOrderItems(items, guestCount = 1) {
  const total = items.reduce((sum, item) => sum + item.lineTotal, 0)
  const orderedCount = items.filter(item => item.itemStatus === 'ordered').length
  const servedCount = items.filter(item => item.itemStatus === 'served').length
  const perPerson = guestCount > 1 ? Math.ceil(total / guestCount) : null

  return {
    total,
    orderedCount,
    servedCount,
    itemCount: items.length,
    guestCount,
    perPerson,
  }
}

export function getCheckoutConfirmMessage(total) {
  return total > 0 ? `現在の合計は¥${total.toLocaleString()}です。スタッフに会計希望を送ります。` : undefined
}
