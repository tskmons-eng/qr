export default function OrderStatusSummary({
  itemCount,
  orderedCount,
  servedCount,
  cancelledCount,
  showServedStatus,
}) {
  if (itemCount === 0 && cancelledCount === 0) return null
  const visibleOrderedCount = showServedStatus ? orderedCount : orderedCount + servedCount

  return (
    <section className="order-status__summary">
      <SummaryCard label={showServedStatus ? '準備中' : '注文済み'} value={visibleOrderedCount} tone="ordered" />
      {showServedStatus && <SummaryCard label="提供済み" value={servedCount} tone="served" />}
      {cancelledCount > 0 && <SummaryCard label="キャンセル" value={cancelledCount} tone="cancelled" />}
    </section>
  )
}

function SummaryCard({ label, value, tone = '' }) {
  return (
    <div className="order-status__summary-card">
      <div className="order-status__summary-label">{label}</div>
      <div className={`order-status__summary-value${tone ? ` order-status__summary-value--${tone}` : ''}`}>
        {value}
      </div>
    </div>
  )
}
