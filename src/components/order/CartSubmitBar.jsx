export default function CartSubmitBar({ submitting, itemCount, total, disabled, onSubmit }) {
  return (
    <div className="customer-cart__submit-bar">
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled}
        className="customer-cart__submit-button"
      >
        {submitting ? '送信中...' : `注文する（${itemCount}品 · ¥${total.toLocaleString()}）`}
      </button>
    </div>
  )
}
