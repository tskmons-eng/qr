// 会計の品の一覧（見るだけ）。品ごとの値引きは「値引き」ボタンの奥（CheckoutDiscountSheet）で入れる。
export default function CheckoutItemList({ rows }) {
  const quantity = rows.reduce((sum, { item }) => sum + (Number(item.quantity) || 0), 0)

  return (
    <div className="checkout-items">
      <div className="checkout-items__title">注文の品（{rows.length}品・{quantity}点）</div>
      {rows.map(({ item, amount, unitPrice, unitDiscount }) => (
        <div key={item.id} className="checkout-item-row">
          <div className="checkout-item-row__name">
            {item.productNameSnapshot}
            {item.quantity > 1 && <small>1つ ¥{unitPrice.toLocaleString()}</small>}
            {amount > 0 && <small className="is-discount">1つ -¥{unitDiscount.toLocaleString()}</small>}
          </div>
          <span className="checkout-item-row__quantity">×{item.quantity}</span>
          <span className="checkout-item-row__price">
            {amount > 0 && <s>¥{item.lineTotal.toLocaleString()}</s>}
            ¥{(item.lineTotal - amount).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}
