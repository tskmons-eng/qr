export function normalizeOwnerEmail(value = '') {
  return String(value ?? '').trim().toLowerCase()
}

export function validateOwnerEmail(email) {
  if (!email || !email.includes('@')) return '正しいメールアドレスを入力してください'
  return ''
}

export function normalizeAllowedEmailEntry(id, data = {}) {
  const email = normalizeOwnerEmail(data.email || id)
  return {
    id: id || email,
    ...data,
    email,
    addedBy: data.addedBy ?? null,
  }
}

export function sortAllowedEmailEntries(entries) {
  return [...entries].sort((a, b) => {
    const timeDiff = (a.addedAt?.seconds ?? 0) - (b.addedAt?.seconds ?? 0)
    if (timeDiff !== 0) return timeDiff
    return (a.email ?? '').localeCompare(b.email ?? '')
  })
}

export function formatAllowedEmailAddedAt(entry) {
  return entry.addedAt?.toDate?.()?.toLocaleString('ja-JP') ?? ''
}
