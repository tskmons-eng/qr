import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useOrder } from '../../contexts/OrderContext'

const statusLabel = { ordered: '準備中', served: '提供済み', cancelled: 'キャンセル' }
const statusColor = { ordered: '#f59e0b', served: '#16a34a', cancelled: '#bbb' }
const statusBg = { ordered: '#fffbeb', served: '#f0fdf4', cancelled: '#f9f9f9' }

export default function OrderCompletePage() {
  const { orderId, table, tableId, storeId, storeConfig } = useOrder()
  const [items, setItems] = useState([])
  const [checkoutStep, setCheckoutStep] = useState(null) // null | 'confirm' | 'sent'
  const [callCooldown, setCallCooldown] = useState(false)
  const callTimerRef = useRef(null)
  const navigate = useNavigate()

  const showServedStatus = storeConfig?.showServedStatus ?? true
  const showItemPrice = storeConfig?.showItemPrice ?? true
  const allowAdditionalOrders = storeConfig?.allowAdditionalOrders ?? true

  useEffect(() => {
    if (!orderId) return
    const q = query(collection(db, 'orderItems'), where('orderId', '==', orderId))
    return onSnapshot(q, snap => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(i => i.itemStatus !== 'cancelled')
        .sort((a, b) => (a.orderedAt?.seconds ?? 0) - (b.orderedAt?.seconds ?? 0))
      setItems(data)
    })
  }, [orderId])

  async function handleCall() {
    if (callCooldown) return
    await addDoc(collection(db, 'calls'), {
      storeId,
      tableId,
      tableName: table.tableName,
      orderId,
      type: 'call',
      status: 'pending',
      createdAt: serverTimestamp(),
    })
    setCallCooldown(true)
    callTimerRef.current = setTimeout(() => setCallCooldown(false), 30000)
  }

  async function handleCheckout() {
    await addDoc(collection(db, 'calls'), {
      storeId,
      tableId,
      tableName: table.tableName,
      orderId,
      type: 'checkout',
      status: 'pending',
      createdAt: serverTimestamp(),
    })
    setCheckoutStep('sent')
  }

  const total = items.reduce((sum, i) => sum + i.lineTotal, 0)
  const orderedCount = items.filter(i => i.itemStatus === 'ordered').length
  const servedCount = items.filter(i => i.itemStatus === 'served').length
  const guestCount = table?.guestCount || 1
  const perPerson = guestCount > 1 ? Math.ceil(total / guestCount) : null

  const showTotal = checkoutStep !== null

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: allowAdditionalOrders ? 88 : 24 }}>
      <header style={{ background: '#222', color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.55, marginBottom: 2 }}>{table.tableName}</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>ご注文状況</div>
        </div>
        {/* 会計ボタン */}
        {checkoutStep === null && (
          <button
            onClick={() => setCheckoutStep('confirm')}
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
          >
            会計
          </button>
        )}
        {checkoutStep === 'confirm' && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setCheckoutStep(null)}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.3)', color: '#aaa', padding: '6px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
            >
              戻る
            </button>
            <button
              onClick={handleCheckout}
              style={{ background: '#2563eb', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              依頼する
            </button>
          </div>
        )}
        {checkoutStep === 'sent' && (
          <span style={{ fontSize: 12, color: '#93c5fd', fontWeight: 600 }}>スタッフが向かいます</span>
        )}
      </header>

      {/* 会計金額（会計ボタンを押したときのみ表示） */}
      {showTotal && total > 0 && (
        <div style={{ background: '#1e3a5f', color: '#fff', padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: perPerson ? 8 : 0 }}>
            <span style={{ fontSize: 14, opacity: 0.8 }}>合計</span>
            <span style={{ fontSize: 24, fontWeight: 800 }}>¥{total.toLocaleString()}</span>
          </div>
          {perPerson && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.7 }}>
              <span style={{ fontSize: 13 }}>お一人様（{guestCount}名）</span>
              <span style={{ fontSize: 16, fontWeight: 600 }}>¥{perPerson.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}

      {/* ステータスサマリー */}
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: 10, padding: '12px 16px', background: '#f8f8f8' }}>
          <div style={{ flex: 1, textAlign: 'center', background: '#fff', borderRadius: 8, padding: '10px 4px', border: '1px solid #eee' }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>準備中</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f59e0b' }}>{orderedCount}</div>
          </div>
          {showServedStatus && (
            <div style={{ flex: 1, textAlign: 'center', background: '#fff', borderRadius: 8, padding: '10px 4px', border: '1px solid #eee' }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>提供済み</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{servedCount}</div>
            </div>
          )}
          <div style={{ flex: 1, textAlign: 'center', background: '#fff', borderRadius: 8, padding: '10px 4px', border: '1px solid #eee' }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>注文数</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{items.length}</div>
          </div>
        </div>
      )}

      {/* 注文一覧 */}
      <div style={{ background: '#fff', marginTop: 1 }}>
        {items.map(item => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid #f0f0f0' }}>
            <div>
              <div style={{ fontSize: 15 }}>{item.productNameSnapshot} × {item.quantity}</div>
              {showServedStatus && (
                <div style={{ display: 'inline-block', marginTop: 4, fontSize: 11, fontWeight: 600, color: statusColor[item.itemStatus], background: statusBg[item.itemStatus], padding: '2px 8px', borderRadius: 10 }}>
                  {statusLabel[item.itemStatus]}
                </div>
              )}
            </div>
            {showItemPrice && (
              <div style={{ fontSize: 14, fontWeight: 600 }}>¥{item.lineTotal.toLocaleString()}</div>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <p style={{ textAlign: 'center', padding: 48, color: '#bbb' }}>注文がありません</p>
        )}
      </div>

      {allowAdditionalOrders && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px', background: '#fff', borderTop: '1px solid #eee' }}>
          <button
            onClick={() => navigate('../menu')}
            style={{ width: '100%', padding: '14px', fontSize: 16, background: '#222', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}
          >
            追加注文する
          </button>
        </div>
      )}

      {/* 呼び出しボタン（右下固定） */}
      <button
        onClick={handleCall}
        disabled={callCooldown}
        style={{
          position: 'fixed',
          bottom: allowAdditionalOrders ? 88 : 24,
          right: 20,
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: callCooldown ? '#aaa' : '#e63946',
          color: '#fff',
          border: 'none',
          cursor: callCooldown ? 'default' : 'pointer',
          fontSize: 11,
          fontWeight: 700,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          lineHeight: 1.2,
        }}
      >
        <span style={{ fontSize: 20 }}>🔔</span>
        <span>{callCooldown ? '送信済' : '呼出'}</span>
      </button>
    </div>
  )
}
