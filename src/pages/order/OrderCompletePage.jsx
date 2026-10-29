import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import CustomerBottomNav from '../../components/CustomerBottomNav'
import OrderStatusHeader from '../../components/order/OrderStatusHeader'
import OrderStatusList from '../../components/order/OrderStatusList'
import OrderStatusSummary from '../../components/order/OrderStatusSummary'
import OrderTotalPanel from '../../components/order/OrderTotalPanel'
import { useCart } from '../../contexts/CartContext'
import { useOrder } from '../../contexts/OrderContext'
import useCustomerCall from '../../hooks/useCustomerCall'
import {
  getCustomerOrderSettings,
  isCustomerOrderRequestReflected,
  summarizeOrderItems,
} from '../../lib/customerOrderStatus'
import { describeUnavailableItems, formatOrderCommandError, logOrderCommandError } from '../../lib/orderCommandErrors'
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
  const { orderId, table, tableId, storeId, storeConfig, storeConfigLoading, customerAccessReady, customerAccessError, retryCustomerAccess } = useOrder()
  const accessRetriedRef = useRef(false)
  const [itemsError, setItemsError] = useState(false)
  const { callDisabled, requestStaff } = useCustomerCall()
  const { restoreCartItems } = useCart()
  const [items, setItems] = useState([])
  const [justOrdered, setJustOrdered] = useState(false)
  const [latestClientRequestId, setLatestClientRequestId] = useState('')
  const [latestSubmittedItemCount, setLatestSubmittedItemCount] = useState(0)
  const [pendingSubmit, setPendingSubmit] = useState(null)
  const [showRecoveryActions, setShowRecoveryActions] = useState(false)
  const [recoverySubmitting, setRecoverySubmitting] = useState(false)
  const [recoveryError, setRecoveryError] = useState('')
  const [checkoutStep, setCheckoutStep] = useState(null)
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
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
  // 2026-10-28 注文の流れ 第2章：お会計は1回押すだけ。合計は「金額を出す」設定の店はいつも、そうでない店は依頼のあとに出す。
  const checkoutSent = checkoutStep === 'sent'
  const showTotal = showItemPrice || checkoutSent
  const latestOrderReflected = isCustomerOrderRequestReflected(items, latestClientRequestId)

  // この端末が注文に加わってから読む（それまでは読めない決まり）。
  useEffect(() => {
    if (!orderId || !customerAccessReady) return undefined
    setItemsError(false)
    return subscribeCustomerOrderItems(orderId, nextItems => {
      setItems(nextItems)
      setItemsError(false)
    }, () => {
      // 読めなかったら1回だけ加わり直す（同じ端末で別の席を開いて記録が上書きされた等）。
      if (!accessRetriedRef.current && retryCustomerAccess) {
        accessRetriedRef.current = true
        retryCustomerAccess()
        return
      }
      setItemsError(true)
    })
  }, [orderId, customerAccessReady])

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
    setJustOrdered(Boolean(location.state?.justOrdered))
    setLatestClientRequestId(nextClientRequestId)
    setLatestSubmittedItemCount(nextSubmittedItemCount)
  }, [location.state, orderId, storeId, tableId])

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
    clearTimeout(recoveryTimerRef.current)
  }, [])

  async function handleCheckout() {
    if (checkoutSubmitting) return
    setCheckoutSubmitting(true)
    setCheckoutError('')
    try {
      await createCustomerCall({
        storeId,
        tableId,
        tableName: table?.tableName ?? '',
        orderId,
        type: 'checkout',
      })
      setCheckoutStep('sent')
    } catch {
      setCheckoutError('会計依頼を送信できませんでした。通信を確認して、もう一度お試しください。')
    } finally {
      setCheckoutSubmitting(false)
    }
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
      const unavailable = describeUnavailableItems(error)
      if (unavailable) {
        clearCustomerSubmitRecovery(retryScope)
        const blocked = new Set(unavailable.productIds)
        restoreCartItems(pendingSubmit.items.filter(item => !blocked.has(item.product.id)))
        navigate('../menu', { replace: true, state: { openCart: true, submitNotice: unavailable.message } })
        return
      }
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

  return (
    <div className={`order-status${checkoutSent ? '' : ' has-checkout-button'}`}>
      <OrderStatusHeader
        tableName={table.tableName}
        checkoutStep={checkoutStep}
        onCall={requestStaff}
        callDisabled={callDisabled}
        loading={storeConfigLoading}
      />
      <OrderTotalPanel
        show={showTotal}
        total={summary.total}
        perPerson={summary.perPerson}
        guestCount={summary.guestCount}
        label="お会計合計"
      />
      <OrderCheckoutNotice checkoutStep={checkoutStep} />
      {(customerAccessError || itemsError) && (
        <section className="order-status__reflection" role="alert">
          <div className="order-status__reflection-title">注文の一覧を読み込めませんでした</div>
          <div className="order-status__reflection-text">通信を確かめて、画面を読み込み直してください。注文は届いています。</div>
        </section>
      )}
      <OrderReflectionNotice
        clientRequestId={latestClientRequestId}
        justOrdered={justOrdered}
        reflected={latestOrderReflected}
        submittedItemCount={latestSubmittedItemCount}
        showActions={showRecoveryActions}
        canRetry={Boolean(pendingSubmit)}
        retrying={recoverySubmitting}
        retryError={recoveryError}
        onRetry={handleRecoveryRetry}
        onCall={requestStaff}
        callDisabled={callDisabled}
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
        showItemPrice={showItemPrice || checkoutSent}
      />
      {!checkoutSent && (
        <div className="order-status__checkout-bar">
          {checkoutError && <p className="order-status__checkout-error" role="alert">{checkoutError}</p>}
          <button type="button" className="order-status__checkout-submit" onClick={handleCheckout} disabled={checkoutSubmitting}>
            {checkoutSubmitting ? '送信中...' : 'お会計をお願いする'}
          </button>
        </div>
      )}
      <CustomerBottomNav
        current="history"
        menuDisabled={storeConfigLoading || !allowAdditionalOrders}
      />
    </div>
  )
}

function OrderCheckoutNotice({ checkoutStep }) {
  if (checkoutStep !== 'sent') return null

  return (
    <section className="order-status__checkout-notice is-sent">
      <div className="order-status__checkout-title">お会計を依頼しました</div>
      <div className="order-status__checkout-text">スタッフが席へ向かいます。注文履歴と合計はこの画面で確かめられます。</div>
    </section>
  )
}

function OrderReflectionNotice({
  clientRequestId,
  justOrdered,
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
    ? `✓ ${countText}ご注文を受け付けました`
    : showActions
      ? '注文の反映を確認中です'
      : `${countText}注文を反映しています`
  const description = reflected
    ? (justOrdered ? '下の一覧で、届いたかどうかを確かめられます。' : '一覧の「今回追加」ラベルで送信済みの商品を確認できます。')
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
