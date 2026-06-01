import { sortChecksByCompletedAtDesc } from '../../lib/adminSales'

export default function TodayCheckList({ checks }) {
  if (checks.length === 0) return null

  return (
    <section className="admin-sales-card">
      <div className="admin-sales-card__header">本日の会計</div>
      {sortChecksByCompletedAtDesc(checks).map(check => (
        <div key={check.id} className="admin-sales-check">
          <div className="admin-sales-check__meta">
            <span className="admin-sales-check__time">
              {check.completedAt?.toDate().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="admin-sales-check__guest">{check.guestCount}名</span>
            {check.closedByEmail && <span className="admin-sales-check__email">{check.closedByEmail}</span>}
          </div>
          <span className="admin-sales-check__total">¥{check.total.toLocaleString()}</span>
        </div>
      ))}
    </section>
  )
}
