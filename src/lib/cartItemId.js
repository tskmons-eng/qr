let fallbackSequence = 0

function normalizeCartItemIdSegment(value) {
  const segment = String(value ?? 'product')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 64)

  return segment || 'product'
}

function randomIdPart() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  fallbackSequence += 1
  return `${Date.now()}_${fallbackSequence}_${Math.random().toString(36).slice(2)}`
}

export function createCartItemId(productId) {
  return `${normalizeCartItemIdSegment(productId)}_${randomIdPart()}`
}
