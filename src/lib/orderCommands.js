export const ORDER_COMMAND_VERSION = 1

function randomSuffix() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export function createOrderCommandRequestId(prefix = 'order-command') {
  return `${prefix}_${randomSuffix()}`
}

export function normalizeOrderCommandSegment(value, fallback = 'unknown') {
  const normalized = String(value ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 96)

  return normalized || fallback
}

export function buildOrderItemCommandDocId({ orderId, clientRequestId, index }) {
  const orderSegment = normalizeOrderCommandSegment(orderId, 'order')
  const requestSegment = normalizeOrderCommandSegment(clientRequestId, 'request')
  const lineSegment = String(index).padStart(3, '0')
  return `oi_${orderSegment}_${requestSegment}_${lineSegment}`
}

export function buildCheckoutCommandDocId({ orderId }) {
  const orderSegment = normalizeOrderCommandSegment(orderId, 'order')
  return `check_${orderSegment}`
}

export function normalizeOrderCommandItems(items) {
  return Array.isArray(items) ? items.filter(Boolean) : []
}
