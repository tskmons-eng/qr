import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, updateDoc, doc, serverTimestamp, increment } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useOrder } from '../../contexts/OrderContext'
import { useCart } from '../../contexts/CartContext'
import CustomerBottomNav from '../../components/CustomerBottomNav'
import { getDiscountedProductPrice } from '../../lib/discounts'

function formatOptions(optionSelections) {
  if (!optionSelections || optionSelections.length === 0) return null
  return optionSelections.map(o => o.choice).join(' · ')
}

function normalizeQuantity(value) {
  const n = parseInt(value, 10)
  if (isNaN(n)) return 0
  return Math.min(99, Math.max(0, n))
}

export default function CartPage() {
  const { tableId, storeId, orderId, table } = useOrder()
  const { items, updateQuantity, clearCart, total, count } = useCart()
  const [submitting, setSubmitting] = useState(false)
  const [callSent, setCallSent] = useState(false)
  const [checkoutSent, setCheckoutSent] = useState(false)
  const cooldownRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => () => clearTimeout(cooldownRef.current), [])

  async function handleCall() {
    if (callSent) return
    await addDoc(collection(db, 'calls'), {
      storeId,
      tableId,
      tableName: table?.tableName ?? '',
      orderId: orderId ?? null,
      type: 'call',
      status: 'pending',
      createdAt: serverTimestamp(),
    })
    setCallSent(true)
    cooldownRef.current = setTimeout(() => setCallSent(false), 30000)
  }

  async function handleCheckout() {
    if (checkoutSent) return
    await addDoc(collection(db, 'calls'), {
      storeId,
      tableId,
      tableName: table?.tableName ?? '',
      orderId: orderId ?? null,
      type: 'checkout',
      status: 'pending',
      createdAt: serverTimestamp(),
    })
    setCheckoutSent(true)
  }

  async function handleSubmit() {
    if (items.length === 0 || !orderId) return
    setSubmitting(true)
    try {
      const now = serverTimestamp()
      await Promise.all(items.map(({ product, quantity, optionSelections }) => {
        const extra = (optionSelections ?? []).reduce((s, o) => s + (o.extraPrice ?? 0), 0)
        const { originalPrice, discountAmount, discountedPrice } = getDiscountedProductPrice(product)
        return addDoc(collection(db, 'orderItems'), {
          orderId,
          storeId,
          tableId,
          productId: product.id,
          productNameSnapshot: product.name,
          unitPriceSnapshot: originalPrice,
          unitDiscountSnapshot: discountAmount,
          discountConfigSnapshot: product.discountConfig ?? null,
          categoryGroup: product.categoryGroup ?? '',
          quantity,
          lineTotal: (discountedPrice + extra) * quantity,
          orderedBy: 'customer',
          itemStatus: 'ordered',
          optionSelections: optionSelections ?? [],
          orderedAt: now,
          updatedAt: now,
        })
      }))
      await updateDoc(doc(db, 'tables', tableId), {
        pendingCount: increment(items.length),
        updatedAt: now,
      })
      clearCart()
      navigate('../complete', { replace: true })
    } catch {
      alert('送信に失敗しました。もう一度試してください。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 156 }}>
      <header style={{ background: '#222', color: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>←</button>
        <span style={{ fontSize: 16, fontWeight: 600 }}>カート確認</span>
      </header>

      {items.length === 0 ? (
        <p style={{ textAlign: 'center', padding: 48, color: '#bbb' }}>カートは空です</p>
      ) : (
        <>
          <div style={{ background: '#fff' }}>
            {items.map(({ id, product, quantity, optionSelections }) => {
              const extra = (optionSelections ?? []).reduce((s, o) => s + (o.extraPrice ?? 0), 0)
              const { originalPrice, discountAmount, discountedPrice } = getDiscountedProductPrice(product)
              const unitPrice = discountedPrice + extra
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #f0f0f0', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15 }}>{product.name}</div>
                    {formatOptions(optionSelections) && (
                      <div style={{ fontSize: 12, color: '#1d4ed8', marginTop: 2 }}>{formatOptions(optionSelections)}</div>
                    )}
                    <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
                      ¥{unitPrice.toLocaleString()}
                      {discountAmount > 0 && <span style={{ marginLeft: 6, color: '#dc2626' }}>通常¥{(originalPrice + extra).toLocaleString()}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => updateQuantity(id, quantity - 1)} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid #ddd', background: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="99"
                      value={quantity}
                      onChange={e => updateQuantity(id, normalizeQuantity(e.target.value))}
                      style={{ width: 52, padding: '6px', fontSize: 15, fontWeight: 700, textAlign: 'center', border: '1px solid #ddd', borderRadius: 8 }}
                    />
                    <button onClick={() => updateQuantity(id, quantity + 1)} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid #ddd', background: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, minWidth: 64, textAlign: 'right' }}>
                    ¥{(unitPrice * quantity).toLocaleString()}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ padding: '16px', background: '#fff', marginTop: 1, display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}>
            <span>合計</span>
            <span>¥{total.toLocaleString()}</span>
          </div>
        </>
      )}

      <div style={{ position: 'fixed', bottom: 74, left: 0, right: 0, padding: '10px 16px', background: '#fff', borderTop: '1px solid #eee', zIndex: 44 }}>
        <button
          onClick={handleSubmit}
          disabled={submitting || items.length === 0}
          style={{ width: '100%', padding: '14px', fontSize: 16, background: items.length === 0 ? '#ccc' : '#222', color: '#fff', border: 'none', borderRadius: 10, cursor: items.length === 0 ? 'not-allowed' : 'pointer' }}
        >
          {submitting ? '送信中...' : `注文する（${count}品 · ¥${total.toLocaleString()}）`}
        </button>
      </div>
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
