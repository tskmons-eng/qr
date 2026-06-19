import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import CustomerBottomNav from '../../components/CustomerBottomNav'
import OrderSubmitCompleteScreen from '../../components/order/OrderSubmitCompleteScreen'
import OrderStatusHeader from '../../components/order/OrderStatusHeader'
import OrderStatusList from '../../components/order/OrderStatusList'
import OrderStatusSummary from '../../components/order/OrderStatusSummary'
import OrderTotalPanel from '../../components/order/OrderTotalPanel'
import { useOrder } from '../../contexts/OrderContext'
import {
  getCheckoutConfirmMessage,
  getCustomerOrderSettings,
  isCustomerOrderRequestReflected,
  summarizeOrderItems,
} from '../../lib/customerOrderStatus'
import { createCustomerCall } from '../../services/customerMenuService'
import { subscribeCustomerOrderItems } from '../../services/customerOrderStatusService'

export default function OrderCompletePage() {
  const { orderId, table, tableId, storeId, storeConfig } = useOrder()
  const [items, setItems] = useState([])
  const [showSubmitComplete, setShowSubmitComplete] = useState(false)
  const [latestClientRequestId, setLatestClientRequestId] = useState('')
  const [latestSubmittedItemCount, setLatestSubmittedItemCount] = useState(0)
  const [checkoutStep, setCheckoutStep] = useState(null)
  const [callCooldown, setCallCooldown] = useState(false)
  const callTimerRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()

  const {
    showServedStatus,
    showItemPrice,
    allowAdditionalOrders,
  } = getCustomerOrderSettings(storeConfig)
  const guestCount = table?.guestCount || 1
  const summary = summarizeOrderItems(items, guestCount)
  const showTotal = checkoutStep !== null
  const latestOrderReflected = isCustomerOrderRequestReflected(items, latestClientRequestId)

  useEffect(() => {
    if (!orderId) return
    return subscribeCustomerOrderItems(orderId, setItems)
  }, [orderId])

  useEffect(() => {
    setShowSubmitComplete(Boolean(location.state?.justOrdered))
    if (location.state?.clientRequestId) {
      setLatestClientRequestId(location.state.clientRequestId)
    }
    if (Number.isFinite(Number(location.state?.submittedItemCount))) {
      setLatestSubmittedItemCount(Number(location.state.submittedItemCount))
    }
  }, [location.state])

  useEffect(() => () => clearTimeout(callTimerRef.current), [])

  async function sendCall(type) {
    await createCustomerCall({
      storeId,
      tableId,
      tableName: table.tableName,
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

  if (showSubmitComplete) {
    return (
      <OrderSubmitCompleteScreen
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
      />
      <OrderReflectionNotice
        clientRequestId={latestClientRequestId}
        reflected={latestOrderReflected}
        submittedItemCount={latestSubmittedItemCount}
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
        showItemPrice={showItemPrice}
      />
      <CustomerBottomNav
        current="checkout"
        onCall={handleCall}
        callDisabled={callCooldown}
        menuDisabled={!allowAdditionalOrders}
        onCheckout={handleCheckout}
        checkoutDisabled={checkoutStep === 'sent'}
        checkoutConfirmMessage={getCheckoutConfirmMessage(summary.total)}
      />
    </div>
  )
}

function OrderReflectionNotice({ clientRequestId, reflected, submittedItemCount }) {
  if (!clientRequestId) return null

  const countText = submittedItemCount > 0 ? `${submittedItemCount}品の` : ''
  const title = reflected
    ? '今回の注文は一覧に反映されました'
    : `${countText}注文を反映しています`
  const description = reflected
    ? '一覧の「今回追加」ラベルで送信済みの商品を確認できます。'
    : '通信状況により数秒かかる場合があります。反映されるまで画面をこのままお待ちください。'

  return (
    <section
      className={`order-status__reflection${reflected ? ' is-reflected' : ' is-pending'}`}
      aria-live="polite"
    >
      <div className="order-status__reflection-title">{title}</div>
      <div className="order-status__reflection-text">{description}</div>
    </section>
  )
}
