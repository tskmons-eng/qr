import { formatSalesTimestamp, sortChecksByCompletedAtDesc } from '../../lib/adminSales'

export default function TodayCheckList({
  checks,
  emptyMessage = '本日の会計はありません',
  includeDate = false,
  onSelectCheck,
  title = '本日の会計',
}) {

  return (
    <section className="admin-sales-card">
      <div className="admin-sales-card__header">{title}</div>
      {checks.length === 0 ? (
        <div className="admin-sales-empty">{emptyMessage}</div>
      ) : sortChecksByCompletedAtDesc(checks).map(check => (
        <button
          key={check.id}
          type="button"
          className="admin-sales-check"
          onClick={() => onSelectCheck(check)}
        >
          <div className="admin-sales-check__content">
            <div className="admin-sales-check__meta">
              <span className="admin-sales-check__time">
                {formatSalesTimestamp(check.completedAt, { includeDate }) || '日時不明'}
              </span>
              <span className="admin-sales-check__guest">{check.guestCount ?? 0}名</span>
            </div>
            <div className="admin-sales-check__submeta">
              <span className={`admin-sales-assignee-badge${check.isSalesAssigned ? '' : ' is-unassigned'}`}>
                {check.salesAssigneeName ? `担当: ${check.salesAssigneeName}` : '担当未設定'}
              </span>
              {(check.closedByStaffName || check.closedByEmail) && (
                <span className="admin-sales-check__email">
                  会計: {check.closedByStaffName ?? check.closedByEmail}
                </span>
              )}
            </div>
          </div>
          <span className="admin-sales-check__amount">
            <span className="admin-sales-check__total">¥{Number(check.total ?? 0).toLocaleString()}</span>
            <span className="admin-sales-check__chevron" aria-hidden="true">›</span>
          </span>
        </button>
      ))}
    </section>
  )
}
