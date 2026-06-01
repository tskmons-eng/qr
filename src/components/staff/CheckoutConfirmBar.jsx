export default function CheckoutConfirmBar({ disabled, submitting, onConfirm }) {
  return (
    <div className="checkout-confirm-bar">
      <button type="button" onClick={onConfirm} disabled={disabled || submitting}>
        {submitting ? '処理中...' : '会計を確定する'}
      </button>
    </div>
  )
}
