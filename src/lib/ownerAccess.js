export function normalizeOwnerEmail(value) {
  return value.trim().toLowerCase()
}

export function validateOwnerEmail(email) {
  if (!email || !email.includes('@')) return '正しいメールアドレスを入力してください'
  return ''
}

export function sortAllowedEmailEntries(entries) {
  return [...entries].sort((a, b) => (a.addedAt?.seconds ?? 0) - (b.addedAt?.seconds ?? 0))
}

export function formatAllowedEmailAddedAt(entry) {
  return entry.addedAt?.toDate?.()?.toLocaleString('ja-JP') ?? ''
}
