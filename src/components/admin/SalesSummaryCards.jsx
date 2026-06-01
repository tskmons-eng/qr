export default function SalesSummaryCards({ businessDate, summary }) {
  const cards = [
    { label: '売上合計', value: `¥${summary.salesTotal.toLocaleString()}` },
    { label: '会計件数', value: `${summary.checkCount}件` },
    { label: '客数', value: `${summary.customerCount}名` },
    { label: '客単価', value: `¥${summary.averageSpend.toLocaleString()}` },
  ]

  return (
    <section className="admin-sales-card admin-sales-card--padded">
      <div className="admin-sales-card__label">本日の売上（{businessDate}）</div>
      <div className="admin-sales-summary">
        {cards.map(({ label, value }) => (
          <div key={label} className="admin-sales-summary__item">
            <div className="admin-sales-summary__label">{label}</div>
            <div className="admin-sales-summary__value">{value}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
