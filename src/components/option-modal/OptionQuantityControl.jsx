export default function OptionQuantityControl({ quantity, totalPrice, onQuantityChange }) {
  return (
    <section className="option-modal__quantity-section">
      <div className="option-modal__quantity-title">数量</div>
      <div className="option-modal__quantity-row">
        <button
          type="button"
          className="option-modal__round-button option-modal__round-button--large"
          onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
        >
          -
        </button>
        <input
          type="number"
          inputMode="numeric"
          min="1"
          max="99"
          value={quantity}
          onChange={event => onQuantityChange(event.target.value)}
          onBlur={event => onQuantityChange(event.target.value)}
          className="option-modal__quantity-input"
        />
        <button
          type="button"
          className="option-modal__round-button option-modal__round-button--large option-modal__round-button--primary"
          onClick={() => onQuantityChange(Math.min(99, quantity + 1))}
        >
          +
        </button>
        <span className="option-modal__quantity-total">¥{totalPrice.toLocaleString()}</span>
      </div>
    </section>
  )
}
