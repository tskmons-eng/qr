import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { doc, collection, query, where, getDocs, addDoc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useStaffMember } from '../../contexts/StaffMemberContext'

export default function CheckoutPage() {
  const { tableId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { orderId, storeId, guestCount } = location.state || {}
  const { activeStaff } = useStaffMember()

  const [items, setItems] = useState([])
  const [taxRate, setTaxRate] = useState(0)
  const [receivedCash, setReceivedCash] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [completedChange, setCompletedChange] = useState(null)
  const [discountType, setDiscountType] = useState(null)
  const [discountValue, setDiscountValue] = useState('')
  const [discountNote, setDiscountNote] = useState('')

  useEffect(() => {
    if (!orderId) return
    async function load() {
      const [itemsSnap, configSnap] = await Promise.all([
        getDocs(query(collection(db, 'orderItems'), where('orderId', '==', orderId))),
        storeId ? getDoc(doc(db, 'storeConfig', storeId)) : Promise.resolve(null),
      ])
      setItems(itemsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.itemStatus !== 'cancelled'))
      if (configSnap?.exists()) setTaxRate(configSnap.data()?.taxRate ?? 0)
      setLoading(false)
    }
    load()
  }, [orderId])

  const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0)
  const taxAmount = taxRate > 0 ? Math.round(subtotal * taxRate / (100 + taxRate)) : 0
  const discountAmount = (() => {
    if (!discountType || !discountValue) return 0
    const v = Number(discountValue)
    if (isNaN(v) || v <= 0) return 0
    if (discountType === 'amount') return Math.min(v, subtotal)
    if (discountType === 'percent') return Math.floor(subtotal * Math.min(v, 100) / 100)
    return 0
  })()
  const total = subtotal - discountAmount
  const received = Number(receivedCash) || 0
  const change = received >= total ? received - total : null

  async function handleConfirm() {
    if (change === null || submitting) return
    setSubmitting(true)
    try {
      const now = serverTimestamp()
      const checkRef = await addDoc(collection(db, 'checks'), {
        storeId,
        tableId,
        orderId,
        guestCount: guestCount ?? 0,
        subtotal,
        discountAmount,
        discountNote: discountNote.trim() || null,
        total,
        receivedCash: received,
        changeAmount: change,
        paymentMethod: 'cash',
        status: 'completed',
        closedByStaffId: activeStaff?.id ?? null,
        closedByStaffName: activeStaff?.name ?? null,
        completedAt: now,
        updatedAt: now,
      })

      await updateDoc(doc(db, 'orders', orderId), {
        status: 'checked_out',
        checkedOutAt: now,
        updatedAt: now,
      })

      await updateDoc(doc(db, 'tables', tableId), {
        status: 'vacant',
        guestCount: 0,
        currentOrderId: null,
        startedAt: null,
        updatedAt: now,
      })

      await addDoc(collection(db, 'staffActions'), {
        storeId,
        actionType: 'checkout',
        targetType: 'check',
        targetId: checkRef.id,
        actorType: 'staff',
        actorStaffId: activeStaff?.id ?? null,
        actorStaffName: activeStaff?.name ?? null,
        note: `会計完了 ¥${total.toLocaleString()}`,
        createdAt: now,
      })

      setCompletedChange(change)
    } catch {
      alert('エラーが発生しました。もう一度試してください。')
    } finally {
      setSubmitting(false)
    }
  }

  // 会計完了画面
  if (completedChange !== null) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0fdf4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✓</div>
        <h2 style={{ fontSize: 22, marginBottom: 8, color: '#166534' }}>会計完了</h2>
        {completedChange > 0 ? (
          <>
            <p style={{ color: '#555', marginBottom: 8, fontSize: 15 }}>お釣り</p>
            <div style={{ fontSize: 52, fontWeight: 800, color: '#166534', marginBottom: 32 }}>
              ¥{completedChange.toLocaleString()}
            </div>
          </>
        ) : (
          <p style={{ fontSize: 18, color: '#555', marginBottom: 32 }}>お釣りなし</p>
        )}
        <button
          onClick={() => navigate('/staff', { replace: true })}
          style={{ padding: '14px 40px', fontSize: 16, background: '#222', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}
        >
          席一覧に戻る
        </button>
      </div>
    )
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>読み込み中...</div>

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 100 }}>
      <div style={{ background: '#fff', padding: '12px 16px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#444' }}>←</button>
        <span style={{ fontSize: 16, fontWeight: 600 }}>会計</span>
        {activeStaff && <span style={{ fontSize: 13, color: '#aaa', marginLeft: 'auto' }}>{activeStaff.name}</span>}
      </div>

      {/* 明細 */}
      <div style={{ marginTop: 12, background: '#fff' }}>
        <div style={{ padding: '8px 16px', fontSize: 12, color: '#888', fontWeight: 600 }}>注文明細</div>
        {items.map(item => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f5f5f5', fontSize: 14 }}>
            <span>{item.productNameSnapshot} × {item.quantity}</span>
            <span>¥{item.lineTotal.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', marginTop: 1, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', fontSize: 15, color: '#888' }}>
        <span>小計</span>
        <span>¥{subtotal.toLocaleString()}</span>
      </div>

      {/* 割引 */}
      <div style={{ background: '#fff', marginTop: 1, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#555' }}>割引</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: discountType ? 12 : 0 }}>
          <button onClick={() => { setDiscountType(discountType === 'amount' ? null : 'amount'); setDiscountValue('') }}
            style={{ padding: '7px 14px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: discountType === 'amount' ? '#222' : '#fff', color: discountType === 'amount' ? '#fff' : '#333' }}>
            金額割引
          </button>
          <button onClick={() => { setDiscountType(discountType === 'percent' ? null : 'percent'); setDiscountValue('') }}
            style={{ padding: '7px 14px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: discountType === 'percent' ? '#222' : '#fff', color: discountType === 'percent' ? '#fff' : '#333' }}>
            率割引
          </button>
        </div>
        {discountType === 'amount' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[100, 200, 500, 1000].map(v => (
                <button key={v} onClick={() => setDiscountValue(String(v))}
                  style={{ padding: '6px 12px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: Number(discountValue) === v ? '#dc2626' : '#fff', color: Number(discountValue) === v ? '#fff' : '#333' }}>
                  −¥{v}
                </button>
              ))}
            </div>
            <input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder="割引額（円）" min="0"
              style={{ width: '100%', padding: '10px 12px', fontSize: 15, border: '1px solid #ddd', borderRadius: 8, boxSizing: 'border-box' }} />
            <input type="text" value={discountNote} onChange={e => setDiscountNote(e.target.value)} placeholder="割引理由（任意）"
              style={{ width: '100%', padding: '8px 12px', fontSize: 14, border: '1px solid #ddd', borderRadius: 8, boxSizing: 'border-box' }} />
          </div>
        )}
        {discountType === 'percent' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[5, 10, 15, 20, 50, 100].map(v => (
                <button key={v} onClick={() => setDiscountValue(String(v))}
                  style={{ padding: '6px 12px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: Number(discountValue) === v ? '#dc2626' : '#fff', color: Number(discountValue) === v ? '#fff' : '#333' }}>
                  {v}%OFF
                </button>
              ))}
            </div>
            <input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder="割引率（%）" min="0" max="100"
              style={{ width: '100%', padding: '10px 12px', fontSize: 15, border: '1px solid #ddd', borderRadius: 8, boxSizing: 'border-box' }} />
            <input type="text" value={discountNote} onChange={e => setDiscountNote(e.target.value)} placeholder="割引理由（任意）"
              style={{ width: '100%', padding: '8px 12px', fontSize: 14, border: '1px solid #ddd', borderRadius: 8, boxSizing: 'border-box' }} />
          </div>
        )}
        {discountAmount > 0 && (
          <div style={{ marginTop: 10, color: '#dc2626', fontSize: 14, fontWeight: 600 }}>
            割引 −¥{discountAmount.toLocaleString()}
          </div>
        )}
      </div>

      <div style={{ background: '#fff', marginTop: 1, padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700 }}>
          <span>合計</span>
          <span>¥{total.toLocaleString()}</span>
        </div>
        {taxAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#aaa', marginTop: 4 }}>
            <span>うち消費税（{taxRate}%）</span>
            <span>¥{taxAmount.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* 預かり金額 */}
      <div style={{ background: '#fff', marginTop: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>お預かり金額</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {[1000, 2000, 5000, 10000].map(amt => (
            <button
              key={amt}
              onClick={() => setReceivedCash(String(amt))}
              style={{ padding: '8px 16px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: Number(receivedCash) === amt ? '#222' : '#fff', color: Number(receivedCash) === amt ? '#fff' : '#333' }}
            >
              ¥{amt.toLocaleString()}
            </button>
          ))}
        </div>
        <input
          type="number"
          value={receivedCash}
          onChange={e => setReceivedCash(e.target.value)}
          placeholder="金額を入力"
          style={{ width: '100%', padding: '12px', fontSize: 22, border: '1px solid #ddd', borderRadius: 8, textAlign: 'right', boxSizing: 'border-box' }}
        />
      </div>

      {change !== null && (
        <div style={{ background: '#f0fdf4', marginTop: 1, padding: '16px', display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 700, color: '#16a34a' }}>
          <span>お釣り</span>
          <span>¥{change.toLocaleString()}</span>
        </div>
      )}
      {receivedCash !== '' && received < total && (
        <div style={{ background: '#fef2f2', marginTop: 1, padding: '12px 16px', fontSize: 14, color: '#dc2626', textAlign: 'center' }}>
          あと ¥{(total - received).toLocaleString()} 不足しています
        </div>
      )}

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px', background: '#fff', borderTop: '1px solid #eee' }}>
        <button
          onClick={handleConfirm}
          disabled={change === null || submitting}
          style={{ width: '100%', padding: '15px', fontSize: 17, background: change === null ? '#ccc' : '#222', color: '#fff', border: 'none', borderRadius: 10, cursor: change === null ? 'not-allowed' : 'pointer' }}
        >
          {submitting ? '処理中...' : '会計を確定する'}
        </button>
      </div>
    </div>
  )
}
