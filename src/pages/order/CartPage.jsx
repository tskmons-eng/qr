import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, updateDoc, doc, serverTimestamp, increment } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useOrder } from '../../contexts/OrderContext'
import { useCart } from '../../contexts/CartContext'

function formatOptions(optionSelections) {
  if (!optionSelections || optionSelections.length === 0) return null
  return optionSelections.map(o => o.choice).join(' · ')
}

export default function CartPage() {
  const { tableId, storeId, orderId } = useOrder()
  const { items, updateQuantity, clearCart, total, count } = useCart()
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit() {
    if (items.length === 0 || !orderId) return
    setSubmitting(true)
    try {
      const now = serverTimestamp()
      await Promise.all(items.map(({ product, quantity, optionSelections }) => {
        const extra = (optionSelections ?? []).reduce((s, o) => s + (o.extraPrice ?? 0), 0)
        return addDoc(collection(db, 'orderItems'), {
          orderId,
          storeId,
          tableId,
          productId: product.id,
          productNameSnapshot: product.name,
          unitPriceSnapshot: product.price,
          categoryGroup: product.categoryGroup ?? '',
          quantity,
          lineTotal: (product.price + extra) * quantity,
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
    <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 88 }}>
      <header style={{ background: '#222', color: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>←</button>
        <span style={{ fontSize: 16, fontWeight: 600 }}>カート確認</span>
      </header>

      {items.length === 0 ? (
        <p style={{ textAlign: 'center', padding: 48, color: '#bbb' }}>カートは空です</p>
      ) : (
        <>
          <div style={{ background: '#fff' }}>
            {items.map(({ id, product, quantity, optionSelections }) => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #f0f0f0', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15 }}>{product.name}</div>
                  {formatOptions(optionSelections) && (
                    <div style={{ fontSize: 12, color: '#1d4ed8', marginTop: 2 }}>{formatOptions(optionSelections)}</div>
                  )}
                  <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>¥{product.price.toLocaleString()}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => updateQuantity(id, quantity - 1)} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid #ddd', background: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ fontSize: 16, fontWeight: 600, minWidth: 24, textAlign: 'center' }}>{quantity}</span>
                  <button onClick={() => updateQuantity(id, quantity + 1)} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid #ddd', background: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, minWidth: 64, textAlign: 'right' }}>
                  ¥{(product.price * quantity).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '16px', background: '#fff', marginTop: 1, display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}>
            <span>合計</span>
            <span>¥{total.toLocaleString()}</span>
          </div>
        </>
      )}

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px', background: '#fff', borderTop: '1px solid #eee' }}>
        <button
          onClick={handleSubmit}
          disabled={submitting || items.length === 0}
          style={{ width: '100%', padding: '14px', fontSize: 16, background: items.length === 0 ? '#ccc' : '#222', color: '#fff', border: 'none', borderRadius: 10, cursor: items.length === 0 ? 'not-allowed' : 'pointer' }}
        >
          {submitting ? '送信中...' : `注文する（${count}品 · ¥${total.toLocaleString()}）`}
        </button>
      </div>
    </div>
  )
}
