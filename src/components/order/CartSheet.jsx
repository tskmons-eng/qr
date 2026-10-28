import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../../contexts/CartContext'
import { useOrder } from '../../contexts/OrderContext'
import {
  clearCustomerSubmitRecovery,
  createCustomerSubmitRecovery,
  markCustomerSubmitRecoveryAccepted,
  saveCustomerSubmitRecovery,
} from '../../lib/customerSubmitRecovery'
import { describeUnavailableItems, formatOrderCommandError, logOrderCommandError } from '../../lib/orderCommandErrors'
import { createOrderCommandRequestId } from '../../lib/orderCommands'
import { submitCustomerCartOrder } from '../../services/customerCartService'
import BottomSheet from '../ui/BottomSheet'
import CartItemList from './CartItemList'
import CartSubmitBar from './CartSubmitBar'

// カート（2026-10-28 注文の流れ 第2章）。別の画面に移らず、メニューの上にシートで出す。
// 注文前は金額を強く出さない（.claude/rules/ui.md 2章）。お会計は「注文履歴・お会計」で確かめる。
// 送信の決まり（clientRequestId の二重送信防止・送信の控え・やり直せる失敗は完了画面で確かめる）は以前のカート画面と同じ。
export default function CartSheet({ initialNotice = '', onClose }) {
  const { tableId, storeId, orderId } = useOrder()
  const { items, updateQuantity, clearCart, removeProducts, count } = useCart()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(initialNotice)
  const submittingRef = useRef(false)
  const submitRequestIdRef = useRef(null)
  const navigate = useNavigate()

  async function handleSubmit() {
    if (submittingRef.current || items.length === 0 || !orderId) return
    submittingRef.current = true
    if (!submitRequestIdRef.current) {
      submitRequestIdRef.current = createOrderCommandRequestId('customer-order')
    }
    setSubmitting(true)
    setSubmitError('')
    const completedRequestId = submitRequestIdRef.current
    saveCustomerSubmitRecovery(createCustomerSubmitRecovery({
      items,
      orderId,
      storeId,
      tableId,
      clientRequestId: completedRequestId,
    }))
    try {
      await submitCustomerCartOrder({
        items,
        orderId,
        storeId,
        tableId,
        clientRequestId: completedRequestId,
      })
      markCustomerSubmitRecoveryAccepted({ orderId, storeId, tableId, clientRequestId: completedRequestId })
      clearCart()
      submitRequestIdRef.current = null
      navigate('../complete', {
        replace: true,
        state: {
          justOrdered: true,
          clientRequestId: completedRequestId,
          submittedItemCount: items.length,
        },
      })
    } catch (error) {
      const formatted = formatOrderCommandError(error, { context: 'customerSubmit' })
      if (formatted.retryable) {
        // 届いているかもしれないので、品は送信の控えに預けてカートは空にする（完了画面で確かめ、送り直す）。
        clearCart()
        navigate('../complete', {
          replace: true,
          state: {
            recoveringPendingSubmit: true,
            clientRequestId: completedRequestId,
            submittedItemCount: items.length,
          },
        })
      } else {
        clearCustomerSubmitRecovery({ orderId, storeId, tableId, clientRequestId: completedRequestId })
        submitRequestIdRef.current = null
        const unavailable = describeUnavailableItems(error)
        if (unavailable) removeProducts(unavailable.productIds)
        setSubmitError(unavailable?.message ?? formatted.message)
      }
      logOrderCommandError({
        operation: 'customer_submit_order',
        error,
        metadata: {
          storeId,
          tableId,
          orderId,
          itemCount: items.length,
          clientRequestId: completedRequestId,
          retryable: formatted.retryable,
        },
      })
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <BottomSheet open title={count > 0 ? `カート（${count}点）` : 'カート'} onClose={() => { if (!submittingRef.current) onClose() }}>
      <div className="customer-cart-sheet">
        {items.length === 0 ? (
          <>
            {/* 売り切れで品を外してカートが空になっても、何が起きたかの知らせは残す。 */}
            {submitError && <p className="customer-cart-sheet__notice" role="alert">{submitError}</p>}
            <p className="customer-cart-sheet__empty">カートは空です。メニューから品を選んでください。</p>
          </>
        ) : (
          <>
            <CartItemList items={items} onUpdateQuantity={updateQuantity} />
            <p className="customer-cart-sheet__note">お会計は「注文履歴・お会計」でまとめて確かめられます。</p>
            <CartSubmitBar
              submitting={submitting}
              itemCount={count}
              disabled={submitting}
              errorMessage={submitError}
              onSubmit={handleSubmit}
            />
          </>
        )}
      </div>
    </BottomSheet>
  )
}
