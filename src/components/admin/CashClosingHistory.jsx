export default function CashClosingHistory({ closings, onSelectDate }) {
  return (
    <section className="admin-sales-card">
      <div className="admin-sales-card__header">レジ締め履歴</div>
      {closings.length === 0 ? (
        <div className="admin-sales-empty">レジ締め履歴はありません</div>
      ) : closings.map(closing => (
        <button
          key={closing.id}
          type="button"
          className="admin-sales-history"
          onClick={() => onSelectDate(closing.businessDate)}
        >
          <div className="admin-sales-history__content">
            <div className="admin-sales-history__main">
              <span className="admin-sales-history__date">{closing.businessDate}</span>
              <span className="admin-sales-history__total">¥{Number(closing.salesTotal ?? 0).toLocaleString()}</span>
            </div>
            <div className="admin-sales-history__meta">
              {closing.checkCount}件 ・ {closing.customerCount}名 ・ 客単価 ¥{Number(closing.averageSpend ?? 0).toLocaleString()}
              {closing.closedByEmail && ` ・ ${closing.closedByEmail}`}
            </div>
            {closing.memo && <div className="admin-sales-history__memo">メモ: {closing.memo}</div>}
          </div>
          <span className="admin-sales-history__chevron" aria-hidden="true">›</span>
        </button>
      ))}
    </section>
  )
}
