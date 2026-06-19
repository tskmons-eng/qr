export default function OrderStatusHeader({ tableName, checkoutStep }) {
  const title = checkoutStep === 'sent'
    ? '会計依頼済み'
    : checkoutStep === 'confirming'
      ? '会計確認'
      : '注文履歴'

  return (
    <header className="order-status__header">
      <div>
        <div className="order-status__table-name">{tableName}</div>
        <div className="order-status__title">{title}</div>
      </div>
      {checkoutStep === 'sent' && (
        <span className="order-status__sent-label">スタッフが向かいます</span>
      )}
    </header>
  )
}
