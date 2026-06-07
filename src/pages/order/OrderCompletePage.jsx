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
  summarizeOrderItems,
} from '../../lib/customerOrderStatus'
import { createCustomerCall } from '../../services/customerMenuService'
import { subscribeCustomerOrderItems } from '../../services/customerOrderStatusService'

export default function OrderCompletePage() {
  const { orderId, table, tableId, storeId, storeConfig } = useOrder()
  const [items, setItems] = useState([])
  const [showSubmitComplete, setShowSubmitComplete] = useState(false)
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

  useEffect(() => {
    if (!orderId) return
    return subscribeCustomerOrderItems(orderId, setItems)
  }, [orderId])

  useEffect(() => {
    setShowSubmitComplete(Boolean(location.state?.justOrdered))
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
          navigate('.', { replace: true, state: {} })
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
      <OrderStatusSummary
        itemCount={summary.itemCount}
        orderedCount={summary.orderedCount}
        servedCount={summary.servedCount}
        showServedStatus={showServedStatus}
      />
      <OrderStatusList
        items={items}
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
