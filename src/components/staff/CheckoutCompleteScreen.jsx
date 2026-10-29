import { isCashPayment, paymentMethodLabel } from '../../lib/paymentMethods'

export default function CheckoutCompleteScreen({ change, onBackToTables, paymentMethod, total }) {
  const isCash = isCashPayment(paymentMethod)

  return (
    <div className="checkout-complete">
      <div className="checkout-complete__icon">✓</div>
      <h2 className="checkout-complete__title">会計完了</h2>
      <p className="checkout-complete__label">{isCash ? 'おつり' : `${paymentMethodLabel(paymentMethod)}で受け取り`}</p>
      <div className="checkout-complete__change">
        ¥{(isCash ? change : total).toLocaleString()}
      </div>
      <button
        type="button"
        className="checkout-complete__button"
        onClick={onBackToTables}
      >
        席一覧に戻る
      </button>
    </div>
  )
}
