import { formatSalesTimestamp, sortChecksByCompletedAtDesc } from '../../lib/adminSales'
import { paymentMethodKey } from '../../lib/closingSummary'
import { paymentMethodLabel } from '../../lib/paymentMethods'

// 会計の一覧（本日・履歴で共通）。どの席か・支払い方法・取り消しが一目で分かるように（2026-10-30 締め 第2章）。
function checkSubline(check) {
  if (check.status === 'voided') {
    return check.correctedByCheckId ? '打ち直し前' : `取り消し${check.voidReason ? `（${check.voidReason}）` : ''}`
  }
  const parts = [`会計 ${check.closedByStaffName ?? check.closedByEmail ?? '不明'}`]
  if (check.correctsCheckId) parts.push('打ち直し')
  if (check.salesAssigneeName) parts.push(`担当 ${check.salesAssigneeName}`)
  return parts.join(' ・ ')
}

export default function TodayCheckList({
  checks,
  count = null,
  emptyMessage = '本日の会計はありません',
  includeDate = false,
  onSelectCheck,
  title = '本日の会計',
}) {
  return (
    <section className="admin-sales-card">
      <div className="admin-sales-card__header">
        <span>{title}（{count ?? checks.length}件）</span>
        <span>新しい順</span>
      </div>
      {checks.length === 0 ? (
        <div className="admin-sales-empty">{emptyMessage}</div>
      ) : sortChecksByCompletedAtDesc(checks).map(check => {
        const voided = check.status === 'voided'
        return (
          <button
            key={check.id}
            type="button"
            className={`admin-sales-check${voided ? ' is-voided' : ''}`}
            onClick={() => onSelectCheck(check)}
          >
            <span className="admin-sales-check__time">
              {formatSalesTimestamp(check.completedAt, { includeDate }) || '日時不明'}
            </span>
            <span className="admin-sales-check__content">
              <span className="admin-sales-check__table">
                {[check.tableNameSnapshot, `${check.guestCount ?? 0}名`].filter(Boolean).join('・')}
              </span>
              <small>{checkSubline(check)}</small>
            </span>
            <span className={`admin-sales-chip is-${voided ? 'voided' : paymentMethodKey(check.paymentMethod)}`}>
              {voided ? '取り消し' : paymentMethodLabel(check.paymentMethod)}
            </span>
            <span className="admin-sales-check__total">¥{Number(check.total ?? 0).toLocaleString()}</span>
            <span className="admin-sales-check__chevron" aria-hidden="true">›</span>
          </button>
        )
      })}
    </section>
  )
}
