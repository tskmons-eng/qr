export default function OptionModalHeader({ productName, unitPrice, originalPrice, totalExtra, discountAmount }) {
  return (
    <header className="option-modal__header">
      <div className="option-modal__title">{productName}</div>
      <div className="option-modal__price">
        ¥{unitPrice.toLocaleString()}
        {discountAmount > 0 && (
          <span className="option-modal__regular-price">
            通常¥{(originalPrice + totalExtra).toLocaleString()}
          </span>
        )}
      </div>
    </header>
  )
}
