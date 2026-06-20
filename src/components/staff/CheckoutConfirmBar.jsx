import OrderCommandErrorNotice from '../OrderCommandErrorNotice'

const CASH_PRESETS = [1000, 2000, 5000, 10000]

function buildCashPresets(total) {
  const presets = [
    { amount: total, label: `ちょうど ¥${total.toLocaleString()}`, variant: 'exact' },
    ...CASH_PRESETS.map(amount => ({ amount, label: `¥${amount.toLocaleString()}`, variant: 'cash' })),
  ]

  return presets.filter(({ amount }, index) => amount > 0 && presets.findIndex(preset => preset.amount === amount) === index)
}

export default function CheckoutConfirmBar({
  change,
  disabled,
  errorMessage,
  onConfirm,
  onReceivedCashChange,
  received,
  receivedCash,
  submitting,
  total,
}) {
  const cashPresets = buildCashPresets(total)

  return (
    <div className="checkout-confirm-bar">
      <div className="checkout-confirm-bar__cash">
        <div className="checkout-confirm-bar__cash-title">お預かり金額</div>
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
      <OrderCommandErrorNotice message={errorMessage} />
      <button type="button" onClick={onConfirm} disabled={disabled || submitting} className="checkout-confirm-bar__submit">
        {submitting ? '処理中...' : '会計を確定する'}
      </button>
    </div>
  )
}
