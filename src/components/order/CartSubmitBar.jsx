import OrderCommandErrorNotice from '../OrderCommandErrorNotice'

export default function CartSubmitBar({ submitting, itemCount, disabled, errorMessage, onSubmit }) {
  return (
    <div className="customer-cart__submit-bar">
      <OrderCommandErrorNotice message={errorMessage} />
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled}
        className="customer-cart__submit-button"
      >
        {submitting ? '送信中...' : `この内容で注文する（${itemCount}品）`}
      </button>
    </div>
  )
}
