export const CUSTOMER_ENTRY_CONFIG_DEFAULTS = {
  showServedStatus: true,
  showItemPrice: true,
  allowAdditionalOrders: true,
  notificationsEnabled: true,
  servedWorkflowEnabled: true,
  guestAutoAdd: {
    enabled: false,
    productId: '',
    productNameSnapshot: '',
    showGuestCountButton: true,
  },
}

export function normalizeCustomerStoreConfig(config = {}) {
  return {
    ...CUSTOMER_ENTRY_CONFIG_DEFAULTS,
    ...config,
    guestAutoAdd: {
      ...CUSTOMER_ENTRY_CONFIG_DEFAULTS.guestAutoAdd,
      ...(config.guestAutoAdd && typeof config.guestAutoAdd === 'object' ? config.guestAutoAdd : {}),
    },
  }
}

export function stepGuestCount(count, delta, min = 1, max = 20) {
  return Math.min(max, Math.max(min, count + delta))
}

export function applyCustomerOrderStartToTable(table, guestCount, orderId) {
  return {
    ...table,
    status: 'occupied',
    guestCount,
    currentOrderId: orderId,
  }
}
