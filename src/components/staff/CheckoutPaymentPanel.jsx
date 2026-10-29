import OrderCommandErrorNotice from '../OrderCommandErrorNotice'
import { buildCashPresets, calculatePerPerson } from '../../lib/checkoutCalculations'
import { PAYMENT_METHOD_OPTIONS, isCashPayment, paymentMethodLabel } from '../../lib/paymentMethods'

// 店の決済端末で受け取ってから確定してもらう（つなぎ込みはしない。TASK.md「作らない方がいい点」）。
const TERMINAL_LABELS = { card: 'カード端末', qr: 'QR決済' }

function checkoutDiscountLabel(discountType, discountValue, discountNote) {
  const base = discountType === 'percent' ? `値引き ${Number(discountValue) || 0}%` : '値引き'
  const note = discountNote.trim()
  return note ? `${base}（${note}）` : base
}

// 会計の右側（スマホでは下に固定）：合計・割り勘・支払い方法・お預かり・確定（2026-10-29 レジ 第2章）。
export default function CheckoutPaymentPanel({
  discountNote,
  discountType,
  discountValue,
  errorMessage,
  guestCount,
  onClearCheckoutDiscount,
  onClearItemDiscounts,
  onConfirm,
  onOpenDiscount,
  onPaymentMethodChange,
  onReceivedCashChange,
  paymentMethod,
  receivedCash,
  submitting,
  taxRate,
  totals,
}) {
  const { change, discountAmount, itemDiscountAmount, received, subtotalBeforeItemDiscount, taxAmount, total, totalDiscountAmount } = totals
  const isCash = isCashPayment(paymentMethod)
  const perPerson = calculatePerPerson(total, guestCount)
  const cashPresets = buildCashPresets(total)
  const methodLabel = paymentMethodLabel(paymentMethod)

  return (
    <div className="checkout-pay">
      <div className="checkout-pay__total">
        <span>合計</span>
        <strong>¥{total.toLocaleString()}</strong>
      </div>
      {totalDiscountAmount > 0 && (
        <div className="checkout-pay__line">
          <span>品の合計</span>
          <span>¥{subtotalBeforeItemDiscount.toLocaleString()}</span>
        </div>
      )}
      {itemDiscountAmount > 0 && (
        <div className="checkout-pay__line is-discount">
          <span>品の値引き<button type="button" onClick={onClearItemDiscounts}>やめる</button></span>
          <span>-¥{itemDiscountAmount.toLocaleString()}</span>
        </div>
      )}
      {discountAmount > 0 && (
        <div className="checkout-pay__line is-discount">
          <span>{checkoutDiscountLabel(discountType, discountValue, discountNote)}<button type="button" onClick={onClearCheckoutDiscount}>やめる</button></span>
          <span>-¥{discountAmount.toLocaleString()}</span>
        </div>
      )}
      {taxAmount > 0 && (
        <div className="checkout-pay__line">
          <span>うち消費税 {taxRate}%</span>
          <span>¥{taxAmount.toLocaleString()}</span>
        </div>
      )}
      {perPerson !== null && (
        <div className="checkout-pay__split">
          <span>{guestCount}名で割ると 1人</span>
          <strong>¥{perPerson.toLocaleString()}</strong>
        </div>
      )}

      <div className="checkout-pay__label">
        <span>支払い方法</span>
        <button
          type="button"
          className={`checkout-pay__discount-button${totalDiscountAmount > 0 ? ' is-active' : ''}`}
          onClick={onOpenDiscount}
        >
          {totalDiscountAmount > 0 ? '値引き中' : '値引き'}
        </button>
      </div>
      <div className="checkout-pay__methods" role="radiogroup" aria-label="支払い方法">
        {PAYMENT_METHOD_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={paymentMethod === option.value}
            className={paymentMethod === option.value ? 'is-active' : ''}
            onClick={() => onPaymentMethodChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {isCash ? (
        <div className="checkout-pay__cash">
          <div className="checkout-pay__presets">
            {cashPresets.map(({ amount, exact }) => (
              <button
                key={amount}
                type="button"
                className={[exact ? 'is-exact' : '', Number(receivedCash) === amount ? 'is-active' : ''].filter(Boolean).join(' ')}
                onClick={() => onReceivedCashChange(String(amount))}
              >
                {exact ? 'ちょうど' : `¥${amount.toLocaleString()}`}
              </button>
            ))}
          </div>
          <div className="checkout-pay__received">
            <input
              className="checkout-cash-input"
              type="number"
              inputMode="numeric"
              min="0"
              value={receivedCash}
              onChange={event => onReceivedCashChange(event.target.value)}
              placeholder="お預かり"
              aria-label="お預かり"
            />
            {change !== null ? (
              <div className="checkout-change">
                <span>お釣り</span>
                <strong>¥{change.toLocaleString()}</strong>
              </div>
            ) : receivedCash !== '' ? (
              <div className="checkout-shortage">あと ¥{(total - received).toLocaleString()}</div>
            ) : (
              <div className="checkout-change is-empty">
                <span>お釣り</span>
                <strong>—</strong>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="checkout-pay__terminal">
          お店の{TERMINAL_LABELS[paymentMethod] ?? methodLabel}で受け取ってから確定してください
        </div>
      )}

      <div className="checkout-pay__spacer" />
      <OrderCommandErrorNotice message={errorMessage} />
      <button
        type="button"
        onClick={onConfirm}
        disabled={change === null || submitting}
        className="checkout-pay__submit"
      >
        {submitting ? '処理中...' : isCash ? '会計を確定する' : `${methodLabel}で会計を確定する`}
      </button>
    </div>
  )
}
