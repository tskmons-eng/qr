const CASH_PRESETS = [1000, 2000, 5000, 10000]

function buildCashPresets(total) {
  const presets = [
    { amount: total, label: `ちょうど ¥${total.toLocaleString()}`, variant: 'exact' },
    ...CASH_PRESETS.map(amount => ({ amount, label: `¥${amount.toLocaleString()}`, variant: 'cash' })),
  ]

  return presets.filter(({ amount }, index) => amount > 0 && presets.findIndex(preset => preset.amount === amount) === index)
}

export default function CheckoutPaymentPanel({
  subtotalBeforeItemDiscount,
  itemDiscountAmount,
  discountType,
  discountValue,
  discountNote,
  discountAmount,
  total,
  taxAmount,
  taxRate,
  receivedCash,
  received,
  change,
  onDiscountTypeChange,
  onDiscountValueChange,
  onDiscountNoteChange,
  onReceivedCashChange,
}) {
  const cashPresets = buildCashPresets(total)

  return (
    <>
      <div className="checkout-row is-muted">
        <span>商品小計</span>
        <span>¥{subtotalBeforeItemDiscount.toLocaleString()}</span>
      </div>
      {itemDiscountAmount > 0 && (
        <div className="checkout-row is-discount">
          <span>商品別割引</span>
          <span>-¥{itemDiscountAmount.toLocaleString()}</span>
        </div>
      )}

      <div className="checkout-panel">
        <div className="checkout-panel__title">会計全体の割引</div>
        <div className="checkout-segment is-compact">
          <button
            type="button"
            className={discountType === 'amount' ? 'is-active' : ''}
            onClick={() => onDiscountTypeChange(discountType === 'amount' ? null : 'amount')}
          >
            金額
          </button>
          <button
            type="button"
            className={discountType === 'percent' ? 'is-active' : ''}
            onClick={() => onDiscountTypeChange(discountType === 'percent' ? null : 'percent')}
          >
            %
          </button>
        </div>
        {discountType && (
          <div className="checkout-panel__fields">
            <input
              type="number"
              value={discountValue}
              onChange={event => onDiscountValueChange(event.target.value)}
              placeholder={discountType === 'percent' ? '割引率（%）' : '割引額（円）'}
              min="0"
              max={discountType === 'percent' ? '100' : undefined}
            />
            <input
              type="text"
              value={discountNote}
              onChange={event => onDiscountNoteChange(event.target.value)}
              placeholder="割引理由（任意）"
            />
          </div>
        )}
        {discountAmount > 0 && (
          <div className="checkout-panel__discount">会計割引 -¥{discountAmount.toLocaleString()}</div>
        )}
      </div>

      <div className="checkout-total">
        <div>
          <span>合計</span>
          <strong>¥{total.toLocaleString()}</strong>
        </div>
        {taxAmount > 0 && (
          <div className="checkout-total__tax">
            <span>内消費税 {taxRate}%</span>
            <span>¥{taxAmount.toLocaleString()}</span>
          </div>
        )}
      </div>

      <div className="checkout-panel is-payment">
        <div className="checkout-panel__title">お預かり金額</div>
        <div className="checkout-cash-presets">
          {cashPresets.map(({ amount, label, variant }) => (
            <button
              key={amount}
              type="button"
              className={[
                variant === 'exact' ? 'checkout-cash-preset--exact' : '',
                Number(receivedCash) === amount ? 'is-active' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onReceivedCashChange(String(amount))}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          className="checkout-cash-input"
          type="number"
          value={receivedCash}
          onChange={event => onReceivedCashChange(event.target.value)}
          placeholder="金額を入力"
        />
      </div>

      {change !== null && (
        <div className="checkout-change">
          <span>お釣り</span>
          <span>¥{change.toLocaleString()}</span>
        </div>
      )}
      {receivedCash !== '' && received < total && (
        <div className="checkout-shortage">あと ¥{(total - received).toLocaleString()} 不足しています</div>
      )}
    </>
  )
}
