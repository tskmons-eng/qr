export default function CartFloatingButton({ count, total, onClick }) {
  if (count <= 0) return null

  return (
    <button
      type="button"
      className="customer-cart-fab"
      onClick={onClick}
      aria-label="カートを確認"
    >
      <span className="customer-cart-fab__icon">
        🛒
        <span className="customer-cart-fab__count">{count}</span>
      </span>
      <span className="customer-cart-fab__text">
        <span>カート</span>
        <span>¥{total.toLocaleString()}</span>
      </span>
    </button>
  )
}
