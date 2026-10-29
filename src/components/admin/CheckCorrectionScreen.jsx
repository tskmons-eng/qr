import { useEffect, useRef, useState } from 'react'
import CheckoutDiscountSheet from '../staff/CheckoutDiscountSheet'
import CheckoutGuestCountPanel from '../staff/CheckoutGuestCountPanel'
import CheckoutHeader from '../staff/CheckoutHeader'
import CheckoutItemDiscountModal from '../staff/CheckoutItemDiscountModal'
import CheckoutItemList from '../staff/CheckoutItemList'
import CheckoutPaymentPanel from '../staff/CheckoutPaymentPanel'
import useCheckoutForm from '../../hooks/useCheckoutForm'
import { formatSalesTimestamp } from '../../lib/adminSales'
import { createOrderCommandRequestId } from '../../lib/orderCommands'
import { formatOrderCommandError, logOrderCommandError } from '../../lib/orderCommandErrors'
import { paymentMethodLabel } from '../../lib/paymentMethods'
import { stepGuestInputValue } from '../../lib/staffTableDetail'
import { correctCheckCommand } from '../../services/orderCommandService'

// 前の会計の値引きを、入れ直しの初めの値にする（会計全体の値引きは金額として戻す）。
function buildInitialForm(check) {
  const itemDiscounts = Object.fromEntries((Array.isArray(check.itemDiscounts) ? check.itemDiscounts : [])
    .filter(row => row?.orderItemId)
    .map(row => [row.orderItemId, { type: row.type ?? 'amount', value: String(row.value ?? ''), note: row.note ?? '' }]))
  const checkoutDiscount = Number(check.checkoutDiscountAmount ?? 0)
  return {
    paymentMethod: check.paymentMethod ?? 'cash',
    discountType: checkoutDiscount > 0 ? 'amount' : null,
    discountValue: checkoutDiscount > 0 ? String(checkoutDiscount) : '',
    discountNote: checkoutDiscount > 0 ? (check.discountNote ?? '') : '',
    itemDiscounts,
  }
}

function previousCheckLine(check) {
  const parts = [
    formatSalesTimestamp(check.completedAt, { includeDate: false }),
    paymentMethodLabel(check.paymentMethod),
    `¥${Number(check.total ?? 0).toLocaleString()}`,
  ]
  const cash = check.receivedCash !== null && check.receivedCash !== undefined
    ? `（お預かり ¥${Number(check.receivedCash).toLocaleString()}・お釣り ¥${Number(check.changeAmount ?? 0).toLocaleString()}）`
    : ''
  return `${parts.filter(Boolean).join('　')}${cash}`
}

// 会計の打ち直し（2026-10-30 締め 第2章）。会計画面と同じ形・同じ部品で、支払い方法・値引き・人数・お預かりを入れ直す。
// 品は変えない。確定すると新しい会計ができ、前の会計は「打ち直し前」として残る。
export default function CheckCorrectionScreen({ activeStaff, check, items, onCancel, onDone, storeId, taxRate }) {
  const checkoutForm = useCheckoutForm({ items, taxRate, initial: buildInitialForm(check) })
  // 人数は前の会計のまま（0名の会計も0名のまま。打ち直しで客数が変わらないように）。
  const [guestCount, setGuestCount] = useState(Math.max(0, Math.round(Number(check.guestCount) || 0)))
  const [editingGuests, setEditingGuests] = useState(false)
  const [guestInput, setGuestInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  // 通信のやり直しで2件にならないように、この画面を開いている間は同じ要求の名前を使う。
  const requestIdRef = useRef(createOrderCommandRequestId('correct-check'))

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [])

  function saveGuests() {
    const next = parseInt(guestInput, 10)
    if (!Number.isNaN(next) && next >= 0) setGuestCount(next)
    setEditingGuests(false)
  }

  async function handleConfirm() {
    const payload = checkoutForm.buildPayload()
    if (payload.change === null || submitting) return
    setSubmitting(true)
    setErrorMessage('')
    try {
      const result = await correctCheckCommand({
        ...payload,
        storeId,
        checkId: check.id,
        guestCount,
        clientRequestId: requestIdRef.current,
      })
      onDone(result)
    } catch (error) {
      setErrorMessage(formatOrderCommandError(error, { context: 'checkout' }).message)
      logOrderCommandError({ operation: 'correct_check', error, metadata: { storeId, checkId: check.id, total: payload.total } })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="checkout-page is-overlay" role="dialog" aria-modal="true" aria-label="会計の打ち直し">
      <CheckoutDiscountSheet {...checkoutForm.discountSheetProps} />
      <CheckoutItemDiscountModal {...checkoutForm.itemDiscountModalProps} />
      <CheckoutHeader
        activeStaff={activeStaff}
        guestCount={guestCount}
        tableName={`打ち直し　${check.tableNameSnapshot ?? ''}`.trim()}
        onBack={onCancel}
        onEditGuests={() => {
          setGuestInput(String(guestCount))
          setEditingGuests(true)
        }}
      />
      <div className="checkout-page__body">
        <div className="checkout-page__items-scroll">
          {editingGuests && (
            <CheckoutGuestCountPanel
              guestInput={guestInput}
              onCancel={() => setEditingGuests(false)}
              onChange={setGuestInput}
              onSave={saveGuests}
              onStep={delta => setGuestInput(value => stepGuestInputValue(value, delta))}
            />
          )}
          <div className="checkout-page__previous">前の会計：{previousCheckLine(check)}</div>
          <CheckoutItemList rows={checkoutForm.totals.itemDiscountRows} title="会計した品" />
        </div>
        <div className="checkout-page__payment">
          <CheckoutPaymentPanel
            {...checkoutForm.paymentPanelProps}
            confirmLabel="打ち直して確定する"
            errorMessage={errorMessage}
            guestCount={guestCount}
            submitting={submitting}
            onConfirm={handleConfirm}
          />
        </div>
      </div>
    </div>
  )
}
