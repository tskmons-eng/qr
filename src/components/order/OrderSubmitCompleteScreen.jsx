export default function OrderSubmitCompleteScreen({ onBackToMenu, onShowStatus }) {
  return (
    <div className="order-submit-complete">
      <div className="order-submit-complete__mark">✓</div>
      <h1 className="order-submit-complete__title">ありがとうございます！</h1>
      <p className="order-submit-complete__text">ご注文を受け付けました。</p>
      <button type="button" onClick={onBackToMenu} className="order-submit-complete__primary">
        注文画面へ戻る
      </button>
      <button type="button" onClick={onShowStatus} className="order-submit-complete__secondary">
        注文確認を見る
      </button>
    </div>
  )
}
