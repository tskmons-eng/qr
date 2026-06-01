export function getBusinessDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function toTimestampDate(timestamp) {
  if (!timestamp) return null
  if (timestamp instanceof Date) return timestamp
  if (typeof timestamp.toDate === 'function') return timestamp.toDate()
  return null
}

export function isSameBusinessDay(timestamp, date = new Date()) {
  const targetDate = toTimestampDate(timestamp)
  if (!targetDate) return false
  return (
    targetDate.getFullYear() === date.getFullYear() &&
    targetDate.getMonth() === date.getMonth() &&
    targetDate.getDate() === date.getDate()
  )
}

export function filterCompletedChecks(checks) {
  return checks.filter(check => check.status === 'completed')
}

export function filterTodayChecks(checks, date = new Date()) {
  return checks.filter(check => isSameBusinessDay(check.completedAt, date))
}

export function sortChecksByCompletedAtDesc(checks) {
  return [...checks].sort((a, b) => (b.completedAt?.seconds ?? 0) - (a.completedAt?.seconds ?? 0))
}

export function sortCashClosingsByBusinessDateDesc(closings) {
  return [...closings].sort((a, b) => String(b.businessDate ?? '').localeCompare(String(a.businessDate ?? '')))
}

export function calculateSalesSummary(checks) {
  const salesTotal = checks.reduce((sum, check) => sum + (check.total ?? 0), 0)
  const customerCount = checks.reduce((sum, check) => sum + (check.guestCount || 0), 0)
  const checkCount = checks.length
  return {
    salesTotal,
    customerCount,
    checkCount,
    averageSpend: checkCount > 0 ? Math.round(salesTotal / checkCount) : 0,
  }
}

export function buildSalesExportRows(checks, formatTimestamp) {
  const header = ['日時', 'スタッフ', '客数', '小計', '割引', '割引理由', '合計', 'お預かり', 'お釣り', '決済方法']
  const rows = sortChecksByCompletedAtDesc(checks).map(check => [
    formatTimestamp(check.completedAt),
    check.closedByStaffName ?? check.closedByEmail ?? '',
    check.guestCount ?? 0,
    check.subtotal ?? check.total,
    check.discountAmount ?? 0,
    check.discountNote ?? '',
    check.total,
    check.receivedCash ?? '',
    check.changeAmount ?? '',
    check.paymentMethod ?? '現金',
  ])
  return [header, ...rows]
}

export function buildSalesExportFilename(date = new Date()) {
  return `売上履歴_${date.toLocaleDateString('ja-JP').replace(/\//g, '-')}.csv`
}
