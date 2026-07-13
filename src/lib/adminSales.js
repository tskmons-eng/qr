const SALES_TIME_ZONE = 'Asia/Tokyo'

function getTokyoDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SALES_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  return Object.fromEntries(parts.map(part => [part.type, part.value]))
}

export function getBusinessDate(date = new Date()) {
  const { year, month, day } = getTokyoDateParts(date)
  return `${year}-${month}-${day}`
}

export function toTimestampDate(timestamp) {
  if (!timestamp) return null
  if (timestamp instanceof Date) return timestamp
  if (typeof timestamp.toDate === 'function') return timestamp.toDate()
  if (Number.isFinite(timestamp.seconds)) return new Date(timestamp.seconds * 1000)
  return null
}

function parseBusinessDate(value) {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    ? date
    : null
}

export function getMonthDateRange(date = new Date()) {
  const { year: yearText, month: monthText } = getTokyoDateParts(date)
  const year = Number(yearText)
  const month = Number(monthText)
  const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return {
    startDate: `${yearText}-${monthText}-01`,
    endDate: `${yearText}-${monthText}-${String(endDay).padStart(2, '0')}`,
  }
}

export function isSameBusinessDay(timestamp, date = new Date()) {
  const targetDate = toTimestampDate(timestamp)
  if (!targetDate) return false
  return getBusinessDate(targetDate) === getBusinessDate(date)
}

export function formatSalesTimestamp(timestamp, { includeDate = true } = {}) {
  const date = toTimestampDate(timestamp)
  if (!date) return ''
  return date.toLocaleString('ja-JP', includeDate
    ? {
        timeZone: SALES_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }
    : {
        timeZone: SALES_TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
      })
}

export function filterCompletedChecks(checks) {
  return checks.filter(check => check.status === 'completed')
}

export function filterTodayChecks(checks, date = new Date()) {
  return checks.filter(check => isSameBusinessDay(check.completedAt, date))
}

export function filterChecksByDateRange(checks, { startDate = null, endDate = null } = {}) {
  const normalizedStart = parseBusinessDate(startDate) ? startDate : null
  const normalizedEnd = parseBusinessDate(endDate) ? endDate : null

  return checks.filter(check => {
    const completedAt = toTimestampDate(check.completedAt)
    if (!completedAt) return false
    const businessDate = getBusinessDate(completedAt)
    if (normalizedStart && businessDate < normalizedStart) return false
    if (normalizedEnd && businessDate > normalizedEnd) return false
    return true
  })
}

export function sortChecksByCompletedAtDesc(checks) {
  return [...checks].sort((a, b) => (
    (toTimestampDate(b.completedAt)?.getTime() ?? 0) - (toTimestampDate(a.completedAt)?.getTime() ?? 0)
  ))
}

export function sortCashClosingsByBusinessDateDesc(closings) {
  return [...closings].sort((a, b) => String(b.businessDate ?? '').localeCompare(String(a.businessDate ?? '')))
}

export function calculateSalesSummary(checks) {
  const salesTotal = checks.reduce((sum, check) => {
    const total = Number(check.total)
    return sum + (Number.isFinite(total) ? total : 0)
  }, 0)
  const customerCount = checks.reduce((sum, check) => {
    const guestCount = Number(check.guestCount)
    return sum + (Number.isFinite(guestCount) ? guestCount : 0)
  }, 0)
  const checkCount = checks.length
  return {
    salesTotal,
    customerCount,
    checkCount,
    averageSpend: checkCount > 0 ? Math.round(salesTotal / checkCount) : 0,
  }
}

function attributionIsAssigned(attribution) {
  return attribution?.status === 'assigned'
    && typeof attribution.assigneeId === 'string'
    && attribution.assigneeId.length > 0
}

export function joinChecksWithAttributions(checks, attributions, assignees = []) {
  const attributionByCheckId = new Map(
    attributions.map(attribution => [attribution.checkId ?? attribution.id, attribution])
  )
  const assigneeById = new Map(assignees.map(assignee => [assignee.id, assignee]))

  return checks.map(check => {
    const salesAttribution = attributionByCheckId.get(check.id) ?? null
    const isSalesAssigned = attributionIsAssigned(salesAttribution)
    const salesAssigneeId = isSalesAssigned ? salesAttribution.assigneeId : null
    const salesAssignee = salesAssigneeId ? (assigneeById.get(salesAssigneeId) ?? null) : null
    const salesAssigneeName = isSalesAssigned
      ? (salesAssignee?.name ?? salesAttribution.assigneeNameSnapshot ?? null)
      : null

    return {
      ...check,
      salesAttribution,
      salesAssignee,
      salesAssigneeId,
      salesAssigneeName,
      isSalesAssigned,
    }
  })
}

export function filterChecksByAssignee(checks, assigneeFilter = 'all') {
  if (!assigneeFilter || assigneeFilter === 'all') return checks
  if (assigneeFilter === 'unassigned') return checks.filter(check => !check.isSalesAssigned)
  return checks.filter(check => check.isSalesAssigned && check.salesAssigneeId === assigneeFilter)
}

export function calculateAttributionSummary(checks, assignees = []) {
  const masterById = new Map(assignees.map(assignee => [assignee.id, assignee]))
  const grouped = new Map()
  const unassigned = {
    assigneeId: null,
    assigneeName: '担当未設定',
    checkCount: 0,
    salesTotal: 0,
  }

  checks.forEach(check => {
    const total = Number(check.total)
    const salesTotal = Number.isFinite(total) ? total : 0
    if (!check.isSalesAssigned || !check.salesAssigneeId) {
      unassigned.checkCount += 1
      unassigned.salesTotal += salesTotal
      return
    }

    const master = check.salesAssignee ?? masterById.get(check.salesAssigneeId) ?? null
    const current = grouped.get(check.salesAssigneeId) ?? {
      assigneeId: check.salesAssigneeId,
      assigneeName: master?.name ?? check.salesAssigneeName ?? '名称不明',
      isActive: master?.isActive !== false,
      checkCount: 0,
      salesTotal: 0,
    }
    current.checkCount += 1
    current.salesTotal += salesTotal
    grouped.set(check.salesAssigneeId, current)
  })

  return {
    ...calculateSalesSummary(checks),
    assignees: [...grouped.values()].sort((a, b) => (
      b.salesTotal - a.salesTotal || a.assigneeName.localeCompare(b.assigneeName, 'ja')
    )),
    unassigned,
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

export function buildAttributedSalesExportRows(checks, formatTimestamp) {
  const header = ['日時', '会計スタッフ', '担当', '客数', '小計', '割引', '割引理由', '合計', 'お預かり', 'お釣り', '決済方法']
  const rows = sortChecksByCompletedAtDesc(checks).map(check => [
    formatTimestamp(check.completedAt),
    check.closedByStaffName ?? check.closedByEmail ?? '',
    check.salesAssigneeName ?? '担当未設定',
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

export function buildAssigneeSummaryExportRows(summary) {
  const header = ['担当', '会計件数', '売上']
  const rows = (summary?.assignees ?? []).map(item => [
    item.assigneeName,
    item.checkCount,
    item.salesTotal,
  ])
  const unassigned = summary?.unassigned ?? { checkCount: 0, salesTotal: 0 }
  rows.push(['担当未設定', unassigned.checkCount, unassigned.salesTotal])
  rows.push(['合計', summary?.checkCount ?? 0, summary?.salesTotal ?? 0])
  return [header, ...rows]
}

export function buildSalesExportFilename(date = new Date()) {
  const [year, month, day] = getBusinessDate(date).split('-').map(Number)
  return `売上履歴_${year}-${month}-${day}.csv`
}
