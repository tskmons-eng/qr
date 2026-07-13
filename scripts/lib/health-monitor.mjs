import { createHash } from 'node:crypto'

const LEVEL_WEIGHT = {
  PASS: 0,
  KNOWN: 0,
  WARN: 1,
  FAIL: 2,
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, stableObject(value[key])])
  )
}

function sortStableRows(rows) {
  return rows
    .map(row => stableObject(row))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
}

function sortCountMap(counts = {}) {
  return Object.fromEntries(
    Object.entries(counts)
      .sort(([left], [right]) => left.localeCompare(right))
  )
}

export function buildPendingFingerprint(audit) {
  const driftedTables = sortStableRows((audit?.driftedTables ?? []).map(row => ({
    tableId: row.tableId ?? null,
    storeId: row.storeId ?? null,
    status: row.status ?? null,
    issues: [...(row.issues ?? [])].sort(),
    actual: row.actual ?? null,
    legacy: row.legacy ?? null,
    aggregate: row.aggregate ?? null,
    aggregateVersion: row.aggregateVersion ?? null,
  })))
  const itemIssues = sortStableRows(audit?.itemIssues ?? [])
  const canonical = JSON.stringify({ driftedTables, itemIssues })
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`
}

export function sanitizeFailureAudit(audit) {
  const summary = audit?.summary ?? {}
  return {
    windowMinutes: audit?.window?.minutes ?? null,
    total: Number(summary.total ?? audit?.rows?.length ?? 0),
    byErrorCode: sortCountMap(summary.byErrorCode),
    byCommandType: sortCountMap(summary.byCommandType),
    diagnosisSignals: [...(summary.diagnosisSignals ?? [])].sort(),
  }
}

export function classifyFailureAudit(audit) {
  const safe = sanitizeFailureAudit(audit)
  if (safe.total === 0) {
    return { level: 'PASS', reasons: ['no_recent_order_command_failures'], safe }
  }

  const severeSignals = safe.diagnosisSignals.filter(signal => (
    signal === 'rules_or_permission_error_seen'
    || signal.startsWith('functions_constant_error_possible:')
    || signal.startsWith('command_cluster:')
  ))
  if (severeSignals.length > 0) {
    return { level: 'FAIL', reasons: severeSignals, safe }
  }

  return { level: 'WARN', reasons: ['isolated_or_mixed_order_command_failures'], safe }
}

export function classifyPendingAudit(audit, baseline) {
  const summary = audit?.summary ?? {}
  const driftedTableCount = Number(summary.driftedTableCount ?? 0)
  const itemIssueCount = Number(summary.itemIssueCount ?? 0)
  const fingerprint = buildPendingFingerprint(audit)
  const safe = {
    tableCount: Number(summary.tableCount ?? 0),
    pendingItemCount: Number(summary.pendingItemCount ?? 0),
    driftedTableCount,
    itemIssueCount,
    baselineDriftedTableCount: baseline.pending.driftedTableCount,
    baselineItemIssueCount: baseline.pending.itemIssueCount,
    fingerprintMatchesBaseline: fingerprint === baseline.pending.fingerprint,
  }

  if (itemIssueCount > baseline.pending.itemIssueCount) {
    return { level: 'FAIL', reasons: ['pending_item_reference_issues_increased'], safe }
  }
  if (driftedTableCount === 0 && itemIssueCount === 0) {
    return { level: 'PASS', reasons: ['pending_drift_resolved'], safe }
  }
  if (driftedTableCount > baseline.pending.driftedTableCount) {
    return { level: 'FAIL', reasons: ['pending_drift_count_increased'], safe }
  }
  if (driftedTableCount === baseline.pending.driftedTableCount && !safe.fingerprintMatchesBaseline) {
    return { level: 'FAIL', reasons: ['pending_drift_targets_changed'], safe }
  }
  if (driftedTableCount < baseline.pending.driftedTableCount) {
    return { level: 'WARN', reasons: ['pending_drift_improved_review_baseline'], safe }
  }

  return { level: 'KNOWN', reasons: ['known_pending_drift_unchanged'], safe }
}

export function combineLevels(levels) {
  return levels.reduce((current, level) => (
    LEVEL_WEIGHT[level] > LEVEL_WEIGHT[current] ? level : current
  ), 'PASS')
}
