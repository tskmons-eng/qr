export default function CheckoutItemDiscountModal({ row, onClose, onUpdate }) {
  if (!row) return null

  const { item, unitPrice, unitDiscount, amount, config } = row

  function update(patch) {
    onUpdate(item.id, patch)
  }

  return (
    <div className="checkout-item-modal" onClick={onClose}>
      <div className="checkout-item-modal__panel" onClick={event => event.stopPropagation()}>
        <div className="checkout-item-modal__header">
          <div>
            <div className="checkout-item-modal__name">{item.productNameSnapshot}</div>
            <div className="checkout-item-modal__meta">
              1個 ¥{unitPrice.toLocaleString()} × {item.quantity}個
            </div>
          </div>
          <button type="button" className="checkout-item-modal__close" onClick={onClose}>×</button>
        </div>

        <div className="checkout-item-modal__stats">
          <div className="checkout-item-modal__stat">
            <span>商品合計</span>
            <strong>¥{item.lineTotal.toLocaleString()}</strong>
          </div>
          <div className={`checkout-item-modal__stat${amount > 0 ? ' has-discount' : ''}`}>
            <span>割引合計</span>
            <strong>-¥{amount.toLocaleString()}</strong>
          </div>
        </div>

        <div className="checkout-item-modal__label">1個あたりの割引</div>
        <div className="checkout-segment">
          <button
            type="button"
            className={config.type === 'amount' ? 'is-active' : ''}
            onClick={() => update({ type: config.type === 'amount' ? null : 'amount', value: '' })}
          >
            円引き
          </button>
          <button
            type="button"
            className={config.type === 'percent' ? 'is-active' : ''}
            onClick={() => update({ type: config.type === 'percent' ? null : 'percent', value: '' })}
          >
            %引き
          </button>
        </div>

        <input
          className="checkout-item-modal__amount"
          type="number"
          value={config.value ?? ''}
          onChange={event => update({ type: config.type ?? 'amount', value: event.target.value })}
          placeholder={config.type === 'percent' ? '割引率（%）' : '1個あたりの割引額（円）'}
          min="0"
          max={config.type === 'percent' ? '100' : undefined}
        />
        <input
          className="checkout-item-modal__note"
          type="text"
          value={config.note ?? ''}
          onChange={event => update({ note: event.target.value })}
          placeholder="割引理由（任意）"
        />

        {amount > 0 && (
          <div className="checkout-item-modal__preview">
            1個あたり -¥{unitDiscount.toLocaleString()} × {item.quantity}個 = -¥{amount.toLocaleString()}
          </div>
        )}

        <div className="checkout-item-modal__actions">
          <button type="button" onClick={() => update({ type: null, value: '', note: '' })}>
            割引なし
          </button>
          <button type="button" className="is-primary" onClick={onClose}>
            決定
          </button>
        </div>
      </div>
    </div>
  )
}
