import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import CustomerBottomNav from '../../components/CustomerBottomNav'
import OrderSubmitCompleteScreen from '../../components/order/OrderSubmitCompleteScreen'
import OrderStatusHeader from '../../components/order/OrderStatusHeader'
import OrderStatusList from '../../components/order/OrderStatusList'
import OrderStatusSummary from '../../components/order/OrderStatusSummary'
import OrderTotalPanel from '../../components/order/OrderTotalPanel'
import { useCart } from '../../contexts/CartContext'
import { useOrder } from '../../contexts/OrderContext'
import {
  getCheckoutConfirmMessage,
  getCustomerOrderSettings,
  isCustomerOrderRequestReflected,
  summarizeOrderItems,
} from '../../lib/customerOrderStatus'
import { formatOrderCommandError, logOrderCommandError } from '../../lib/orderCommandErrors'
import {
  CUSTOMER_SUBMIT_RECOVERY_ACTION_DELAY_MS,
  clearCustomerSubmitRecovery,
  loadCustomerSubmitRecovery,
  markCustomerSubmitRecoveryAccepted,
  markCustomerSubmitRecoveryAttempt,
} from '../../lib/customerSubmitRecovery'
import { submitCustomerCartOrder } from '../../services/customerCartService'
import { createCustomerCall } from '../../services/customerMenuService'
import { subscribeCustomerOrderItems } from '../../services/customerOrderStatusService'

export default function OrderCompletePage() {
  const { orderId, table, tableId, storeId, storeConfig } = useOrder()
  const { count: cartCount } = useCart()
  const [items, setItems] = useState([])
  const [showSubmitComplete, setShowSubmitComplete] = useState(false)
  const [latestClientRequestId, setLatestClientRequestId] = useState('')
  const [latestSubmittedItemCount, setLatestSubmittedItemCount] = useState(0)
  const [pendingSubmit, setPendingSubmit] = useState(null)
  const [showRecoveryActions, setShowRecoveryActions] = useState(false)
  const [recoverySubmitting, setRecoverySubmitting] = useState(false)
  const [recoveryError, setRecoveryError] = useState('')
  const [checkoutStep, setCheckoutStep] = useState(null)
  const [callCooldown, setCallCooldown] = useState(false)
  const callTimerRef = useRef(null)
  const recoveryTimerRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()

  const {
    showServedStatus,
    showItemPrice,
    allowAdditionalOrders,
  } = getCustomerOrderSettings(storeConfig)
  const guestCount = table?.guestCount || 1
  const summary = summarizeOrderItems(items, guestCount)
  const isCheckoutPreview = checkoutStep === 'confirming' || checkoutStep === 'sent'
  const showTotal = isCheckoutPreview
  const latestOrderReflected = isCustomerOrderRequestReflected(items, latestClientRequestId)

  useEffect(() => {
    if (!orderId) return
    return subscribeCustomerOrderItems(orderId, setItems)
  }, [orderId])

  useEffect(() => {
    const savedSubmit = orderId
      ? loadCustomerSubmitRecovery({ orderId, storeId, tableId })
      : null
    const stateClientRequestId = location.state?.clientRequestId
    const nextClientRequestId = stateClientRequestId || savedSubmit?.clientRequestId || ''
    const stateSubmittedItemCount = Number(location.state?.submittedItemCount)
    const nextSubmittedItemCount = Number.isFinite(stateSubmittedItemCount) && stateSubmittedItemCount > 0
      ? stateSubmittedItemCount
      : savedSubmit?.submittedItemCount ?? 0

    setPendingSubmit(savedSubmit)
    setShowSubmitComplete(Boolean(location.state?.justOrdered))
    setLatestClientRequestId(nextClientRequestId)
    setLatestSubmittedItemCount(nextSubmittedItemCount)
  }, [location.state, orderId, storeId, tableId])

  useEffect(() => {
    if (!location.state?.checkoutPreview) return
    setCheckoutStep(prev => prev === 'sent' ? prev : 'confirming')
  }, [location.state])

  useEffect(() => {
    if (!latestClientRequestId || !latestOrderReflected) return
    clearCustomerSubmitRecovery({ orderId, storeId, tableId, clientRequestId: latestClientRequestId })
    setPendingSubmit(prev => prev?.clientRequestId === latestClientRequestId ? null : prev)
    setShowRecoveryActions(false)
    setRecoveryError('')
  }, [latestClientRequestId, latestOrderReflected, orderId, storeId, tableId])

  useEffect(() => {
    clearTimeout(recoveryTimerRef.current)
    if (!latestClientRequestId || latestOrderReflected) {
      setShowRecoveryActions(false)
      return undefined
    }

    const waitStart = Number(pendingSubmit?.acceptedAt ?? pendingSubmit?.lastAttemptAt ?? pendingSubmit?.createdAt ?? Date.now())
    const remainingMs = Math.max(0, CUSTOMER_SUBMIT_RECOVERY_ACTION_DELAY_MS - (Date.now() - waitStart))
    if (remainingMs === 0) {
      setShowRecoveryActions(true)
      return undefined
    }

    setShowRecoveryActions(false)
    recoveryTimerRef.current = setTimeout(() => setShowRecoveryActions(true), remainingMs)
    return () => clearTimeout(recoveryTimerRef.current)
  }, [latestClientRequestId, latestOrderReflected, pendingSubmit])

  useEffect(() => () => {
    clearTimeout(callTimerRef.current)
    clearTimeout(recoveryTimerRef.current)
  }, [])

  async function sendCall(type) {
    await createCustomerCall({
      storeId,
      tableId,
      tableName: table?.tableName ?? '',
      orderId,
      type,
    })
  }

  async function handleCall() {
    if (callCooldown) return
    await sendCall('call')
    setCallCooldown(true)
    callTimerRef.current = setTimeout(() => setCallCooldown(false), 30000)
  }

  async function handleCheckout() {
    await sendCall('checkout')
    setCheckoutStep('sent')
  }

  async function handleRecoveryRetry() {
    if (!pendingSubmit || recoverySubmitting) return
    const retryScope = {
      orderId,
      storeId,
      tableId,
      clientRequestId: pendingSubmit.clientRequestId,
    }
    const attemptSnapshot = markCustomerSubmitRecoveryAttempt(retryScope)
    if (attemptSnapshot) setPendingSubmit(attemptSnapshot)
    setRecoverySubmitting(true)
    setRecoveryError('')
    setShowRecoveryActions(false)

    try {
      await submitCustomerCartOrder({
        items: pendingSubmit.items,
        orderId,
        storeId,
        tableId,
        clientRequestId: pendingSubmit.clientRequestId,
      })
      const acceptedSnapshot = markCustomerSubmitRecoveryAccepted(retryScope)
      if (acceptedSnapshot) setPendingSubmit(acceptedSnapshot)
    } catch (error) {
      const formatted = formatOrderCommandError(error, { context: 'customerSubmit' })
      setRecoveryError(formatted.retryable
        ? '再送結果を確認しています。保存済みの場合はこのまま一覧に反映されます。'
        : formatted.message)
      logOrderCommandError({
        operation: 'customer_submit_order_recovery_retry',
        error,
        metadata: {
          storeId,
          tableId,
          orderId,
          itemCount: pendingSubmit.items.length,
          clientRequestId: pendingSubmit.clientRequestId,
          retryable: formatted.retryable,
        },
      })
    } finally {
      setRecoverySubmitting(false)
    }
  }

  if (showSubmitComplete && (!latestClientRequestId || latestOrderReflected)) {
    return (
      <OrderSubmitCompleteScreen
        submittedItemCount={latestSubmittedItemCount}
        onBackToMenu={() => navigate('../menu', { replace: true })}
        onShowStatus={() => {
          setShowSubmitComplete(false)
          navigate('.', {
            replace: true,
            state: {
              clientRequestId: latestClientRequestId,
              submittedItemCount: latestSubmittedItemCount,
            },
          })
        }}
      />
    )
  }

  return (
    <div className="order-status">
      <OrderStatusHeader
        tableName={table.tableName}
        checkoutStep={checkoutStep}
      />
      <OrderTotalPanel
        show={showTotal}
        total={summary.total}
        perPerson={summary.perPerson}
        guestCount={summary.guestCount}
        label="お会計合計"
      />
      <OrderCheckoutNotice
        checkoutStep={checkoutStep}
        itemCount={summary.itemCount}
        cartCount={cartCount}
        onOpenCart={() => navigate('../cart')}
      />
      <OrderReflectionNotice
        clientRequestId={latestClientRequestId}
        reflected={latestOrderReflected}
        submittedItemCount={latestSubmittedItemCount}
        showActions={showRecoveryActions}
        canRetry={Boolean(pendingSubmit)}
        retrying={recoverySubmitting}
        retryError={recoveryError}
        onRetry={handleRecoveryRetry}
        onCall={handleCall}
        callDisabled={callCooldown}
      />
      <OrderStatusSummary
        itemCount={summary.itemCount}
        orderedCount={summary.orderedCount}
        servedCount={summary.servedCount}
        cancelledCount={summary.cancelledCount}
        showServedStatus={showServedStatus}
      />
      <OrderStatusList
        items={items}
        latestClientRequestId={latestClientRequestId}
        isReflectingLatestOrder={Boolean(latestClientRequestId) && !latestOrderReflected}
        showServedStatus={showServedStatus}
        showItemPrice={showItemPrice || isCheckoutPreview}
      />
      <CustomerBottomNav
        current="checkout"
        onCall={handleCall}
        callDisabled={callCooldown}
        menuDisabled={!allowAdditionalOrders}
        onCheckout={checkoutStep === 'confirming' ? handleCheckout : undefined}
        checkoutDisabled={checkoutStep === 'sent'}
        checkoutLabel={checkoutStep === 'confirming' ? '会計依頼' : '注文確認'}
        checkoutConfirmMessage={getCheckoutConfirmMessage(summary.total)}
      />
    </div>
  )
}

function OrderCheckoutNotice({ checkoutStep, itemCount, cartCount, onOpenCart }) {
  if (checkoutStep !== 'confirming' && checkoutStep !== 'sent') return null

  const sent = checkoutStep === 'sent'
  const title = sent ? '会計依頼を送信しました' : '会計確認'
  const description = sent
    ? 'スタッフが席へ向かいます。注文履歴と合計はこの画面で確認できます。'
    : itemCount > 0
      ? '注文済みの内容と合計を確認してから、会計を依頼してください。'
      : '注文済みの商品がまだありません。必要な場合だけスタッフへ会計を依頼してください。'

  return (
    <section className={`order-status__checkout-notice${sent ? ' is-sent' : ''}`}>
      <div className="order-status__checkout-title">{title}</div>
      <div className="order-status__checkout-text">{description}</div>
      {!sent && cartCount > 0 && (
        <div className="order-status__checkout-cart-warning">
          <span>カートに未注文の商品が{cartCount}点あります。</span>
          <button type="button" onClick={onOpenCart} className="order-status__checkout-cart-button">
            カートを見る
          </button>
        </div>
      )}
    </section>
  )
}

function OrderReflectionNotice({
  clientRequestId,
  reflected,
  submittedItemCount,
  showActions,
  canRetry,
  retrying,
  retryError,
  onRetry,
  onCall,
  callDisabled,
}) {
  if (!clientRequestId) return null

  const countText = submittedItemCount > 0 ? `${submittedItemCount}品の` : ''
  const title = reflected
    ? '今回の注文は一覧に反映されました'
    : showActions
      ? '注文の反映を確認中です'
      : `${countText}注文を反映しています`
  const description = reflected
    ? '一覧の「今回追加」ラベルで送信済みの商品を確認できます。'
    : showActions
      ? '通信状況により確認に時間がかかっています。未反映の場合だけ、同じ受付番号で再送できます。'
      : '保存済みの可能性があるため、すぐに失敗扱いにはしません。反映されるまで画面をこのままお待ちください。'

  return (
    <section
      className={`order-status__reflection${reflected ? ' is-reflected' : ' is-pending'}`}
      aria-live="polite"
    >
      <div className="order-status__reflection-title">{title}</div>
      <div className="order-status__reflection-text">{description}</div>
      {!reflected && showActions && (
        <div className="order-status__reflection-actions">
          {canRetry && (
            <button
              type="button"
              className="order-status__reflection-button order-status__reflection-button--primary"
              onClick={onRetry}
              disabled={retrying}
            >
              {retrying ? '再送中...' : '同じ内容で再送'}
            </button>
          )}
          <button
            type="button"
            className="order-status__reflection-button"
            onClick={onCall}
            disabled={callDisabled}
          >
            スタッフを呼ぶ
          </button>
        </div>
      )}
      {retryError && (
        <div className="order-status__reflection-error">{retryError}</div>
      )}
    </section>
  )
}
