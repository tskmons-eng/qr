export function stepGuestCount(count, delta, min = 1, max = 20) {
  return Math.min(max, Math.max(min, count + delta))
}

export function getCustomerEntryStartPath(orderId) {
  return orderId ? 'menu' : 'guests'
}

export function applyCustomerOrderStartToTable(table, guestCount, orderId) {
  return {
    ...table,
    status: 'occupied',
    guestCount,
    currentOrderId: orderId,
  }
}
