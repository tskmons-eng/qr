export default function CheckoutGuestCountPanel({
  editing,
  guestCount,
  guestInput,
  onCancel,
  onChange,
  onEdit,
  onSave,
  onStep,
}) {
  return (
    <div className="checkout-guest-panel">
      <div>
        <div className="checkout-guest-panel__label">人数</div>
        {editing ? (
          <div className="checkout-guest-panel__edit">
            <button type="button" onClick={() => onStep(-1)} className="checkout-guest-panel__step">−</button>
            <input
              type="number"
              min="0"
              value={guestInput}
              onChange={event => onChange(event.target.value)}
              className="checkout-guest-panel__input"
            />
            <button type="button" onClick={() => onStep(1)} className="checkout-guest-panel__step">+</button>
          </div>
        ) : (
          <div className="checkout-guest-panel__value">{guestCount}名</div>
        )}
      </div>
      {editing ? (
        <div className="checkout-guest-panel__actions">
          <button type="button" onClick={onCancel} className="checkout-guest-panel__button">戻る</button>
          <button type="button" onClick={onSave} className="checkout-guest-panel__button checkout-guest-panel__button--primary">保存</button>
        </div>
      ) : (
        <button type="button" onClick={onEdit} className="checkout-guest-panel__button checkout-guest-panel__button--primary">
          変更
        </button>
      )}
    </div>
  )
}
