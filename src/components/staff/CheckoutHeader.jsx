// 会計の画面の上の帯：戻る・席の名前・人数（押すと変える）・担当。
export default function CheckoutHeader({ activeStaff, guestCount, onBack, onEditGuests, tableName }) {
  return (
    <div className="checkout-header">
      <button type="button" className="checkout-header__back" onClick={onBack} aria-label="戻る">←</button>
      <div className="checkout-header__title">
        <strong>{tableName || '会計'}</strong>
        <button type="button" className="checkout-header__guests" onClick={onEditGuests}>
          {guestCount}名<span>変更</span>
        </button>
      </div>
      {activeStaff && <span className="checkout-header__staff">{activeStaff.name}</span>}
    </div>
  )
}
