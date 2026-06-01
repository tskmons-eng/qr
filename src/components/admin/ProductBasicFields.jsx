export default function ProductBasicFields({
  name,
  price,
  isVisible,
  isSoldOut,
  onNameChange,
  onPriceChange,
  onVisibleChange,
  onSoldOutChange,
}) {
  return (
    <>
      <div>
        <label className="product-form-label">商品名</label>
        <input
          value={name}
          onChange={event => onNameChange(event.target.value)}
          required
          className="product-form-input"
        />
      </div>

      <div>
        <label className="product-form-label">価格（税込）</label>
        <input
          type="number"
          value={price}
          onChange={event => onPriceChange(event.target.value)}
          required
          min="0"
          className="product-form-input"
        />
      </div>

      <div className="product-status-row">
        <label className="product-status-toggle">
          <input type="checkbox" checked={isVisible} onChange={event => onVisibleChange(event.target.checked)} />
          メニューに表示
        </label>
        <label className="product-status-toggle">
          <input type="checkbox" checked={isSoldOut} onChange={event => onSoldOutChange(event.target.checked)} />
          売り切れ
        </label>
      </div>
    </>
  )
}
