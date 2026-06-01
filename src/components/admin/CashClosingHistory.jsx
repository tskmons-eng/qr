export default function CashClosingHistory({ closings }) {
  if (closings.length === 0) return null

  return (
    <section className="admin-sales-card">
      <div className="admin-sales-card__header">レジ締め履歴</div>
      {closings.map(closing => (
        <div key={closing.id} className="admin-sales-history">
          <div className="admin-sales-history__main">
            <span className="admin-sales-history__date">{closing.businessDate}</span>
            <span className="admin-sales-history__total">¥{closing.salesTotal.toLocaleString()}</span>
          </div>
          <div className="admin-sales-history__meta">
            {closing.checkCount}件 ・ {closing.customerCount}名 ・ 客単価 ¥{closing.averageSpend.toLocaleString()}
            {closing.closedByEmail && ` ・ ${closing.closedByEmail}`}
          </div>
          {closing.memo && <div className="admin-sales-history__memo">メモ: {closing.memo}</div>}
        </div>
      ))}
    </section>
  )
}
