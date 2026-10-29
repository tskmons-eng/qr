// 値引き（2026-10-29 レジ 第2章）。使う頻度が低いので、表には「値引き」ボタンだけを出し、会計全体と品ごとをここにまとめる。
// 品を押すと、品ごとの値引き（CheckoutItemDiscountModal）がこの上に開く。
const CHECKOUT_DISCOUNT_TYPES = [
  { value: null, label: 'なし' },
  { value: 'amount', label: '金額（円）' },
  { value: 'percent', label: '%' },
]

export default function CheckoutDiscountSheet({
  discountNote,
  discountType,
  discountValue,
  onClose,
  onDiscountNoteChange,
  onDiscountTypeChange,
  onDiscountValueChange,
  onSelectItem,
  open,
  rows,
  totalDiscountAmount,
}) {
  if (!open) return null

  return (
    <div className="checkout-discount-sheet" onClick={onClose}>
      <div className="checkout-discount-sheet__panel" onClick={event => event.stopPropagation()}>
        <div className="checkout-discount-sheet__header">
          <h2>値引き</h2>
          <button type="button" onClick={onClose}>閉じる</button>
        </div>

        <div className="checkout-discount-sheet__label">会計全体</div>
        <div className="checkout-discount-sheet__types">
          {CHECKOUT_DISCOUNT_TYPES.map(option => (
            <button
              key={option.label}
              type="button"
              className={discountType === option.value ? 'is-active' : ''}
              onClick={() => onDiscountTypeChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {discountType && (
          <div className="checkout-discount-sheet__fields">
            <input
              type="number"
              inputMode="numeric"
              value={discountValue}
              onChange={event => onDiscountValueChange(event.target.value)}
              placeholder={discountType === 'percent' ? '%' : '円'}
              min="0"
              max={discountType === 'percent' ? '100' : undefined}
              aria-label={discountType === 'percent' ? '値引きの割合（%）' : '値引きの金額（円）'}
            />
            <input
              type="text"
              value={discountNote}
              onChange={event => onDiscountNoteChange(event.target.value)}
              placeholder="理由（なくてもよい）"
              aria-label="値引きの理由"
            />
          </div>
        )}

        <div className="checkout-discount-sheet__label">品ごと（押して値引きを入れる）</div>
        <div className="checkout-discount-sheet__items">
          {rows.map(({ item, amount }) => (
            <button key={item.id} type="button" className="checkout-discount-sheet__item" onClick={() => onSelectItem(item.id)}>
              <span className="checkout-discount-sheet__item-name">{item.productNameSnapshot} ×{item.quantity}</span>
              <span className="checkout-discount-sheet__item-price">
                {amount > 0 && <s>¥{item.lineTotal.toLocaleString()}</s>}
                ¥{(item.lineTotal - amount).toLocaleString()}
              </span>
              <span className={`checkout-discount-sheet__item-tag${amount > 0 ? ' is-active' : ''}`}>
                {amount > 0 ? '変更' : '値引き'}
              </span>
            </button>
          ))}
        </div>

        {totalDiscountAmount > 0 && (
          <div className="checkout-discount-sheet__sum">
            <span>値引きの合計</span>
            <span>-¥{totalDiscountAmount.toLocaleString()}</span>
          </div>
        )}
        <button type="button" className="checkout-discount-sheet__done" onClick={onClose}>決める</button>
      </div>
    </div>
  )
}
