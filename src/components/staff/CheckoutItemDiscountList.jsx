export default function CheckoutItemDiscountList({ rows, onSelect }) {
  return (
    <div className="checkout-items">
      <div className="checkout-items__title">注文明細・商品別割引（商品をタップ）</div>
      {rows.map(({ item, amount, unitPrice, unitDiscount }) => (
        <button
          key={item.id}
          type="button"
          className="checkout-item-row"
          onClick={() => onSelect(item.id)}
        >
          <div className="checkout-item-row__main">
            <div className="checkout-item-row__name">{item.productNameSnapshot} × {item.quantity}</div>
            <div className="checkout-item-row__unit">1個 ¥{unitPrice.toLocaleString()}</div>
            {amount > 0 && (
              <div className="checkout-item-row__discount">
                1個 -¥{unitDiscount.toLocaleString()} / 合計 -¥{amount.toLocaleString()}
              </div>
            )}
          </div>
          <div className="checkout-item-row__price">
            <div className={amount > 0 ? 'is-discounted' : ''}>¥{item.lineTotal.toLocaleString()}</div>
            {amount > 0 && <strong>¥{(item.lineTotal - amount).toLocaleString()}</strong>}
            <span>タップして割引</span>
          </div>
        </button>
      ))}
    </div>
  )
}
