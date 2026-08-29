import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CustomerBottomNav from '../../components/CustomerBottomNav'
import CartItemList from '../../components/order/CartItemList'
import CartSubmitBar from '../../components/order/CartSubmitBar'
import CustomerTopBar from '../../components/order/CustomerTopBar'
import { useCart } from '../../contexts/CartContext'
import { useOrder } from '../../contexts/OrderContext'
import useCustomerCall from '../../hooks/useCustomerCall'
import { formatOrderCommandError, logOrderCommandError } from '../../lib/orderCommandErrors'
import { createOrderCommandRequestId } from '../../lib/orderCommands'
import {
  clearCustomerSubmitRecovery,
  createCustomerSubmitRecovery,
  loadCustomerSubmitRecovery,
  markCustomerSubmitRecoveryAccepted,
  saveCustomerSubmitRecovery,
} from '../../lib/customerSubmitRecovery'
import { submitCustomerCartOrder } from '../../services/customerCartService'

export default function CartPage() {
  const { tableId, storeId, orderId, table } = useOrder()
  const { items, updateQuantity, clearCart, count } = useCart()
  const { callDisabled, requestStaff } = useCustomerCall()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const submittingRef = useRef(false)
  const submitRequestIdRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!orderId || !storeId || !tableId || submittingRef.current) return
    const pendingSubmit = loadCustomerSubmitRecovery({ orderId, storeId, tableId })
    if (!pendingSubmit) return
    submitRequestIdRef.current = pendingSubmit.clientRequestId
    navigate('../complete', {
      replace: true,
      state: {
        recoveringPendingSubmit: true,
        clientRequestId: pendingSubmit.clientRequestId,
        submittedItemCount: pendingSubmit.submittedItemCount,
      },
    })
  }, [orderId, storeId, tableId, navigate])

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
        setSubmitError(formatted.message)
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
    <div className={`customer-cart${items.length === 0 ? ' is-empty' : ' has-items'}`}>
      <CustomerTopBar
        tableName={table?.tableName ?? ''}
        title="カート"
        onCall={requestStaff}
        callDisabled={callDisabled}
      />
      <main className="customer-cart__content">
        {items.length === 0 ? (
          <section className="customer-cart__empty">
            <div className="customer-cart__empty-mark" aria-hidden="true">＋</div>
            <h2>カートは空です</h2>
            <p>メニューから商品を選ぶと、ここでまとめて注文できます。</p>
            <button type="button" onClick={() => navigate('../menu')}>メニューを見る</button>
          </section>
        ) : (
          <CartItemList
            items={items}
            onUpdateQuantity={updateQuantity}
          />
        )}
      </main>
      {items.length > 0 && (
        <CartSubmitBar
          submitting={submitting}
          itemCount={count}
          disabled={submitting}
          errorMessage={submitError}
          onSubmit={handleSubmit}
        />
      )}
      <CustomerBottomNav current="cart" />
    </div>
  )
}
