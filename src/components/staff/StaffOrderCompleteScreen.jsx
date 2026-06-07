export default function StaffOrderCompleteScreen({ onBackToTable }) {
  return (
    <div className="staff-order-complete">
      <div className="staff-order-complete__mark">✓</div>
      <h1 className="staff-order-complete__title">注文完了！</h1>
      <p className="staff-order-complete__text">追加注文を送信しました。</p>
      <button type="button" onClick={onBackToTable} className="staff-order-complete__button">
        席に戻る
      </button>
    </div>
  )
}
