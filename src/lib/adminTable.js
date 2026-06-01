export const TABLE_STATUS_LABELS = {
  vacant: '空席',
  occupied: '使用中',
  checkout_pending: '会計待ち',
}

export function normalizeTableName(name) {
  return name.trim()
}

export function buildTableOrderUrl(baseUrl, qrToken) {
  return `${baseUrl}/order/${qrToken}`
}

export function generateTableQrToken(randomValues = crypto.getRandomValues.bind(crypto)) {
  const bytes = new Uint8Array(16)
  randomValues(bytes)
  return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('')
}
