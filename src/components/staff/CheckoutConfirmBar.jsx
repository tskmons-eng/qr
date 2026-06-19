import OrderCommandErrorNotice from '../OrderCommandErrorNotice'

export default function CheckoutConfirmBar({ disabled, errorMessage, submitting, onConfirm }) {
  return (
    <div className="checkout-confirm-bar">
      <OrderCommandErrorNotice message={errorMessage} />
      <button type="button" onClick={onConfirm} disabled={disabled || submitting}>
        {submitting ? '処理中...' : '会計を確定する'}
      </button>
    </div>
  )
}
