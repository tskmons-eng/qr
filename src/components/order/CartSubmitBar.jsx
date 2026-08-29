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
        {submitting ? '注文を送信しています...' : `${itemCount}点を注文する`}
      </button>
    </div>
  )
}
