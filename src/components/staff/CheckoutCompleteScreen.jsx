export default function CheckoutCompleteScreen({ change, onBackToTables }) {
  return (
    <div className="checkout-complete">
      <div className="checkout-complete__icon">✓</div>
      <h2 className="checkout-complete__title">会計完了</h2>
      <p className="checkout-complete__label">おつり</p>
      <div className="checkout-complete__change">
        ¥{change.toLocaleString()}
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
