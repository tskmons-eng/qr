export const TABLE_STATUS_LABELS = {
  vacant: '空席',
  occupied: '使用中',
  checkout_pending: '会計待ち',
}

// 席の管理の一覧に出す、いまの使われ方（空き／○名・食事中／会計待ち）。
export function describeTableUse(table) {
  if (table.status === 'vacant' && !table.currentOrderId) return { label: '空き', vacant: true }
  if (table.status === 'checkout_pending') return { label: '会計待ち', vacant: false }
  const guests = Number(table.guestCount) > 0 ? `${table.guestCount}名・` : ''
  return { label: `${guests}食事中`, vacant: false }
}

export const DEFAULT_PUBLIC_ORDER_BASE_URL = 'https://qrproduct-3340b.web.app'

export function normalizeTableName(name) {
  return name.trim()
}

export function buildTableOrderUrl(baseUrl, qrToken) {
  return `${baseUrl.replace(/\/$/, '')}/order/${qrToken}`
}

export function getPublicOrderBaseUrl() {
  return import.meta.env?.VITE_PUBLIC_ORDER_BASE_URL?.replace(/\/$/, '') || DEFAULT_PUBLIC_ORDER_BASE_URL
}

export function generateTableQrToken(randomValues = crypto.getRandomValues.bind(crypto)) {
  const bytes = new Uint8Array(16)
  randomValues(bytes)
  return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('')
}
