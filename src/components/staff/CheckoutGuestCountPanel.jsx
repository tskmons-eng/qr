// 人数を変える（上の帯の「◯名 変更」を押したときだけ出る）。
export default function CheckoutGuestCountPanel({
  guestInput,
  onCancel,
  onChange,
  onSave,
  onStep,
}) {
  return (
    <div className="checkout-guest-panel">
      <span className="checkout-guest-panel__label">人数</span>
      <div className="checkout-guest-panel__edit">
        <button type="button" onClick={() => onStep(-1)} className="checkout-guest-panel__step" aria-label="1人減らす">−</button>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          value={guestInput}
          onChange={event => onChange(event.target.value)}
          className="checkout-guest-panel__input"
          aria-label="人数"
        />
        <button type="button" onClick={() => onStep(1)} className="checkout-guest-panel__step" aria-label="1人増やす">+</button>
      </div>
      <div className="checkout-guest-panel__actions">
        <button type="button" onClick={onCancel} className="checkout-guest-panel__button">戻る</button>
        <button type="button" onClick={onSave} className="checkout-guest-panel__button checkout-guest-panel__button--primary">保存</button>
      </div>
    </div>
  )
}
