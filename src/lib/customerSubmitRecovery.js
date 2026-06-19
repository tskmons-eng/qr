export const CUSTOMER_SUBMIT_RECOVERY_STORAGE_KEY = 'qr.customerSubmitRecovery.v1'
export const CUSTOMER_SUBMIT_RECOVERY_TTL_MS = 15 * 60 * 1000
export const CUSTOMER_SUBMIT_RECOVERY_ACTION_DELAY_MS = 20000

function defaultStorage() {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function normalizeQuantity(value) {
  const quantity = Number(value)
  if (!Number.isFinite(quantity)) return 0
  return Math.max(0, Math.min(99, Math.trunc(quantity)))
}

function normalizeOptionSelections(optionSelections) {
  if (!Array.isArray(optionSelections)) return []
  return optionSelections.map(option => ({
    groupName: normalizeText(option?.groupName),
    choice: normalizeText(option?.choice),
    extraPrice: Number(option?.extraPrice) || 0,
  }))
}

export function normalizeCustomerSubmitRecoveryItems(items) {
  if (!Array.isArray(items)) return []
  return items
    .map(item => {
      const product = item?.product ?? {}
      const productId = normalizeText(product.id)
      const quantity = normalizeQuantity(item?.quantity)
      if (!productId || quantity <= 0) return null

      return {
        id: normalizeText(item?.id) || `${productId}_${Date.now()}`,
        quantity,
        optionSelections: normalizeOptionSelections(item?.optionSelections),
        product: {
          ...product,
          id: productId,
          name: normalizeText(product.name) || '商品',
          price: Number(product.price) || 0,
          categoryGroup: normalizeText(product.categoryGroup),
          discountConfig: product.discountConfig ?? null,
        },
      }
    })
    .filter(Boolean)
}

export function createCustomerSubmitRecovery({
  items,
  orderId,
  storeId,
  tableId,
  clientRequestId,
  now = Date.now(),
}) {
  const normalizedItems = normalizeCustomerSubmitRecoveryItems(items)
  const requestId = normalizeText(clientRequestId)
  const scope = {
    orderId: normalizeText(orderId),
    storeId: normalizeText(storeId),
    tableId: normalizeText(tableId),
  }

  if (!requestId || !scope.orderId || !scope.storeId || !scope.tableId || normalizedItems.length === 0) {
    return null
  }

  return {
    ...scope,
    clientRequestId: requestId,
    items: normalizedItems,
    submittedItemCount: normalizedItems.length,
    createdAt: now,
    lastAttemptAt: now,
    acceptedAt: null,
    attemptCount: 1,
    status: 'pending',
  }
}

function isScopeMatch(snapshot, { orderId, storeId, tableId } = {}) {
  if (!snapshot) return false
  if (orderId !== undefined && snapshot.orderId !== normalizeText(orderId)) return false
  if (storeId !== undefined && snapshot.storeId !== normalizeText(storeId)) return false
  if (tableId !== undefined && snapshot.tableId !== normalizeText(tableId)) return false
  return true
}

function isValidSnapshot(snapshot) {
  return Boolean(
    snapshot &&
    normalizeText(snapshot.clientRequestId) &&
    normalizeText(snapshot.orderId) &&
    normalizeText(snapshot.storeId) &&
    normalizeText(snapshot.tableId) &&
    Array.isArray(snapshot.items) &&
    snapshot.items.length > 0,
  )
}

export function isCustomerSubmitRecoveryExpired(snapshot, now = Date.now()) {
  const createdAt = Number(snapshot?.createdAt)
  if (!Number.isFinite(createdAt)) return true
  return now - createdAt > CUSTOMER_SUBMIT_RECOVERY_TTL_MS
}

export function saveCustomerSubmitRecovery(snapshot, storage = defaultStorage()) {
  if (!storage || !isValidSnapshot(snapshot)) return null
  try {
    storage.setItem(CUSTOMER_SUBMIT_RECOVERY_STORAGE_KEY, JSON.stringify(snapshot))
    return snapshot
  } catch {
    return null
  }
}

export function loadCustomerSubmitRecovery(scope = {}, storage = defaultStorage(), now = Date.now()) {
  if (!storage) return null
  try {
    const raw = storage.getItem(CUSTOMER_SUBMIT_RECOVERY_STORAGE_KEY)
    if (!raw) return null
    const snapshot = JSON.parse(raw)
    if (!isValidSnapshot(snapshot) || isCustomerSubmitRecoveryExpired(snapshot, now) || !isScopeMatch(snapshot, scope)) {
      storage.removeItem(CUSTOMER_SUBMIT_RECOVERY_STORAGE_KEY)
      return null
    }
    return snapshot
  } catch {
    try {
      storage.removeItem(CUSTOMER_SUBMIT_RECOVERY_STORAGE_KEY)
    } catch {
      // ignore storage cleanup failures
    }
    return null
  }
}

export function updateCustomerSubmitRecovery(updates, scope = {}, storage = defaultStorage(), now = Date.now()) {
  const snapshot = loadCustomerSubmitRecovery(scope, storage, now)
  if (!snapshot) return null
  const nextSnapshot = { ...snapshot, ...updates }
  return saveCustomerSubmitRecovery(nextSnapshot, storage)
}

export function markCustomerSubmitRecoveryAttempt(scope, storage = defaultStorage(), now = Date.now()) {
  const snapshot = loadCustomerSubmitRecovery(scope, storage, now)
  if (!snapshot) return null
  return saveCustomerSubmitRecovery({
    ...snapshot,
    status: 'pending',
    lastAttemptAt: now,
    attemptCount: (Number(snapshot.attemptCount) || 0) + 1,
  }, storage)
}

export function markCustomerSubmitRecoveryAccepted(scope, storage = defaultStorage(), now = Date.now()) {
  const snapshot = loadCustomerSubmitRecovery(scope, storage, now)
  if (!snapshot) return null
  return saveCustomerSubmitRecovery({
    ...snapshot,
    status: 'accepted',
    lastAttemptAt: now,
    acceptedAt: now,
  }, storage)
}

export function clearCustomerSubmitRecovery(scope = {}, storage = defaultStorage(), now = Date.now()) {
  if (!storage) return false
  const snapshot = loadCustomerSubmitRecovery({}, storage, now)
  if (!snapshot) return false
  if (!isScopeMatch(snapshot, scope)) return false
  if (scope.clientRequestId !== undefined && snapshot.clientRequestId !== normalizeText(scope.clientRequestId)) return false
  try {
    storage.removeItem(CUSTOMER_SUBMIT_RECOVERY_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

export function shouldShowCustomerSubmitRecoveryActions(
  snapshot,
  now = Date.now(),
  delayMs = CUSTOMER_SUBMIT_RECOVERY_ACTION_DELAY_MS,
) {
  if (!snapshot) return false
  const waitStart = Number(snapshot.acceptedAt ?? snapshot.lastAttemptAt ?? snapshot.createdAt)
  if (!Number.isFinite(waitStart)) return true
  return now - waitStart >= delayMs
}
