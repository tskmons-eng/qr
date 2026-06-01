export default function CustomerCallButton({ cooldown, allowAdditionalOrders, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={cooldown}
      className={`order-status__call-button${cooldown ? ' is-cooldown' : ''}${allowAdditionalOrders ? ' has-additional-orders' : ''}`}
    >
      <span className="order-status__call-icon">🔔</span>
      <span>{cooldown ? '送信済' : '呼出'}</span>
    </button>
  )
}
