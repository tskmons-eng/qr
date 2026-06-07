export default function OrderStatusHeader({ tableName, checkoutStep }) {
  return (
    <header className="order-status__header">
      <div>
        <div className="order-status__table-name">{tableName}</div>
        <div className="order-status__title">ご注文状況</div>
      </div>
      {checkoutStep === 'sent' && (
        <span className="order-status__sent-label">スタッフが向かいます</span>
      )}
    </header>
  )
}
