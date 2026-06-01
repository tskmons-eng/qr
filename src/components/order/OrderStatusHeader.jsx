export default function OrderStatusHeader({ tableName, checkoutStep, onStartCheckout, onCancelCheckout, onConfirmCheckout }) {
  return (
    <header className="order-status__header">
      <div>
        <div className="order-status__table-name">{tableName}</div>
        <div className="order-status__title">ご注文状況</div>
      </div>
      {checkoutStep === null && (
        <button type="button" onClick={onStartCheckout} className="order-status__header-button">
          会計
        </button>
      )}
      {checkoutStep === 'confirm' && (
        <div className="order-status__header-actions">
          <button type="button" onClick={onCancelCheckout} className="order-status__header-button order-status__header-button--ghost">
            戻る
          </button>
          <button type="button" onClick={onConfirmCheckout} className="order-status__header-button order-status__header-button--primary">
            依頼する
          </button>
        </div>
      )}
      {checkoutStep === 'sent' && (
        <span className="order-status__sent-label">スタッフが向かいます</span>
      )}
    </header>
  )
}
