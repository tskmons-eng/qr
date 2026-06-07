import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CustomerBottomNav from '../../components/CustomerBottomNav'
import CartHeader from '../../components/order/CartHeader'
import CartItemList from '../../components/order/CartItemList'
import CartSubmitBar from '../../components/order/CartSubmitBar'
import { useCart } from '../../contexts/CartContext'
import { useOrder } from '../../contexts/OrderContext'
import { submitCustomerCartOrder } from '../../services/customerCartService'
import { createCustomerCall } from '../../services/customerMenuService'

export default function CartPage() {
  const { tableId, storeId, orderId, table } = useOrder()
  const { items, updateQuantity, clearCart, total, count } = useCart()
  const [submitting, setSubmitting] = useState(false)
  const [callSent, setCallSent] = useState(false)
  const [checkoutSent, setCheckoutSent] = useState(false)
  const cooldownRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => () => clearTimeout(cooldownRef.current), [])

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
    if (callSent) return
    await sendCall('call')
    setCallSent(true)
    cooldownRef.current = setTimeout(() => setCallSent(false), 30000)
  }

  async function handleCheckout() {
    if (checkoutSent) return
    await sendCall('checkout')
    setCheckoutSent(true)
  }

  async function handleSubmit() {
    if (items.length === 0 || !orderId) return
    setSubmitting(true)
    try {
      await submitCustomerCartOrder({ items, orderId, storeId, tableId })
      clearCart()
      navigate('../complete', { replace: true, state: { justOrdered: true } })
    } catch {
      alert('送信に失敗しました。もう一度試してください。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="customer-cart">
      <CartHeader onBack={() => navigate(-1)} />
      <CartItemList
        items={items}
        total={total}
        onUpdateQuantity={updateQuantity}
      />
      <CartSubmitBar
        submitting={submitting}
        itemCount={count}
        total={total}
        disabled={submitting || items.length === 0}
        onSubmit={handleSubmit}
      />
      <CustomerBottomNav
        current="cart"
        onCall={handleCall}
        callDisabled={callSent}
        onCheckout={handleCheckout}
        checkoutDisabled={checkoutSent}
        checkoutConfirmMessage={items.length > 0 ? 'カート内の商品はまだ注文されません。会計希望だけスタッフに送ります。' : undefined}
      />
    </div>
  )
}
