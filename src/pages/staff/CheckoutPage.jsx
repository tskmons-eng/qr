import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { doc, collection, query, where, getDocs, addDoc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useStaffMember } from '../../contexts/StaffMemberContext'
import StaffBottomNav from '../../components/StaffBottomNav'

function calcDiscount(base, type, value) {
  const v = Number(value)
  if (isNaN(v) || v <= 0) return 0
  if (type === 'percent') return Math.min(base, Math.floor(base * Math.min(v, 100) / 100))
  return Math.min(base, v)
}

function calcItemDiscount(item, type, value) {
  const quantity = Math.max(1, Number(item.quantity) || 1)
  const lineTotal = Number(item.lineTotal) || 0
  const rawUnitPrice = lineTotal / quantity
  const unitPrice = Math.round(rawUnitPrice)
  const v = Number(value)
  if (isNaN(v) || v <= 0 || !type) {
    return { amount: 0, unitPrice, unitDiscount: 0 }
  }
  const unitDiscount = type === 'percent'
    ? Math.min(rawUnitPrice, Math.floor(rawUnitPrice * Math.min(v, 100) / 100))
    : Math.min(rawUnitPrice, v)
  return { amount: Math.min(lineTotal, Math.round(unitDiscount * quantity)), unitPrice, unitDiscount: Math.round(unitDiscount) }
}

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
  const [itemDiscounts, setItemDiscounts] = useState({})
  const [selectedItemId, setSelectedItemId] = useState(null)

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
  }, [orderId, storeId])

  function updateItemDiscount(itemId, patch) {
    setItemDiscounts(prev => ({ ...prev, [itemId]: { type: 'amount', value: '', note: '', ...(prev[itemId] ?? {}), ...patch } }))
  }

  const itemDiscountRows = items.map(item => {
    const config = itemDiscounts[item.id] ?? {}
    const { amount, unitPrice, unitDiscount } = calcItemDiscount(item, config.type, config.value)
    return { item, config, amount, unitPrice, unitDiscount }
  })
  const subtotalBeforeItemDiscount = items.reduce((sum, i) => sum + i.lineTotal, 0)
  const itemDiscountAmount = itemDiscountRows.reduce((sum, r) => sum + r.amount, 0)
  const subtotal = subtotalBeforeItemDiscount - itemDiscountAmount
  const discountAmount = calcDiscount(subtotal, discountType, discountValue)
  const totalDiscountAmount = itemDiscountAmount + discountAmount
  const total = subtotal - discountAmount
  const taxAmount = taxRate > 0 ? Math.round(total * taxRate / (100 + taxRate)) : 0
  const received = Number(receivedCash) || 0
  const change = received >= total ? received - total : null
  const activeItemDiscounts = itemDiscountRows
    .filter(r => r.amount > 0)
    .map(({ item, config, amount, unitPrice, unitDiscount }) => ({
      orderItemId: item.id,
      productNameSnapshot: item.productNameSnapshot,
      quantity: item.quantity,
      unitPrice,
      type: config.type,
      value: Number(config.value) || 0,
      unitDiscountAmount: unitDiscount,
      amount,
      note: config.note?.trim() || null,
    }))
  const selectedItemRow = itemDiscountRows.find(r => r.item.id === selectedItemId)

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
        subtotalBeforeItemDiscount,
        itemDiscountAmount,
        itemDiscounts: activeItemDiscounts,
        subtotal,
        checkoutDiscountAmount: discountAmount,
        discountAmount: totalDiscountAmount,
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
        actionType: discountAmount > 0 || itemDiscountAmount > 0 ? 'checkout_discount' : 'checkout',
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

  if (completedChange !== null) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0fdf4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✓</div>
        <h2 style={{ fontSize: 22, marginBottom: 8, color: '#166534' }}>会計完了</h2>
        <p style={{ color: '#555', marginBottom: 8, fontSize: 15 }}>お釣り</p>
        <div style={{ fontSize: 52, fontWeight: 800, color: '#166534', marginBottom: 32 }}>
          ¥{completedChange.toLocaleString()}
        </div>
        <button onClick={() => navigate('/staff', { replace: true })} style={{ padding: '14px 40px', fontSize: 16, background: '#222', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
          席一覧に戻る
        </button>
      </div>
    )
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>読み込み中...</div>

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 172 }}>
      {selectedItemRow && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setSelectedItemId(null)}
        >
          <div
            style={{ width: '100%', maxWidth: 600, background: '#fff', borderRadius: '18px 18px 0 0', padding: 20, boxSizing: 'border-box', boxShadow: '0 -10px 32px rgba(0,0,0,0.18)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{selectedItemRow.item.productNameSnapshot}</div>
                <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
                  1個 ¥{selectedItemRow.unitPrice.toLocaleString()} × {selectedItemRow.item.quantity}個
                </div>
              </div>
              <button onClick={() => setSelectedItemId(null)} style={{ border: 'none', background: '#f3f4f6', color: '#555', borderRadius: 99, width: 34, height: 34, cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              <div style={{ background: '#f9fafb', border: '1px solid #eee', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>商品合計</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>¥{selectedItemRow.item.lineTotal.toLocaleString()}</div>
              </div>
              <div style={{ background: selectedItemRow.amount > 0 ? '#fef2f2' : '#f9fafb', border: selectedItemRow.amount > 0 ? '1px solid #fecaca' : '1px solid #eee', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: selectedItemRow.amount > 0 ? '#dc2626' : '#888', marginBottom: 4 }}>割引合計</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: selectedItemRow.amount > 0 ? '#dc2626' : '#222' }}>-¥{selectedItemRow.amount.toLocaleString()}</div>
              </div>
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>1個あたりの割引</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button
                onClick={() => updateItemDiscount(selectedItemRow.item.id, { type: selectedItemRow.config.type === 'amount' ? null : 'amount', value: '' })}
                style={{ flex: 1, padding: '10px', fontSize: 14, border: '1px solid #ddd', borderRadius: 8, background: selectedItemRow.config.type === 'amount' ? '#222' : '#fff', color: selectedItemRow.config.type === 'amount' ? '#fff' : '#333', cursor: 'pointer', fontWeight: 700 }}
              >
                円引き
              </button>
              <button
                onClick={() => updateItemDiscount(selectedItemRow.item.id, { type: selectedItemRow.config.type === 'percent' ? null : 'percent', value: '' })}
                style={{ flex: 1, padding: '10px', fontSize: 14, border: '1px solid #ddd', borderRadius: 8, background: selectedItemRow.config.type === 'percent' ? '#222' : '#fff', color: selectedItemRow.config.type === 'percent' ? '#fff' : '#333', cursor: 'pointer', fontWeight: 700 }}
              >
                %引き
              </button>
            </div>
            <input
              type="number"
              value={selectedItemRow.config.value ?? ''}
              onChange={e => updateItemDiscount(selectedItemRow.item.id, { type: selectedItemRow.config.type ?? 'amount', value: e.target.value })}
              placeholder={selectedItemRow.config.type === 'percent' ? '割引率（%）' : '1個あたりの割引額（円）'}
              min="0"
              max={selectedItemRow.config.type === 'percent' ? '100' : undefined}
              style={{ width: '100%', padding: '12px', fontSize: 18, border: '1px solid #ddd', borderRadius: 10, boxSizing: 'border-box', marginBottom: 8 }}
            />
            <input
              type="text"
              value={selectedItemRow.config.note ?? ''}
              onChange={e => updateItemDiscount(selectedItemRow.item.id, { note: e.target.value })}
              placeholder="割引理由（任意）"
              style={{ width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid #ddd', borderRadius: 10, boxSizing: 'border-box', marginBottom: 12 }}
            />
            {selectedItemRow.amount > 0 && (
              <div style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
                1個あたり -¥{selectedItemRow.unitDiscount.toLocaleString()} × {selectedItemRow.item.quantity}個 = -¥{selectedItemRow.amount.toLocaleString()}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => updateItemDiscount(selectedItemRow.item.id, { type: null, value: '', note: '' })}
                style={{ flex: 1, padding: '12px', fontSize: 14, background: '#fff', color: '#666', border: '1px solid #ddd', borderRadius: 10, cursor: 'pointer' }}
              >
                割引なし
              </button>
              <button
                onClick={() => setSelectedItemId(null)}
                style={{ flex: 1, padding: '12px', fontSize: 14, background: '#222', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }}
              >
                決定
              </button>
            </div>
          </div>
        </div>
      )}
      <div style={{ background: '#fff', padding: '12px 16px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#444' }}>←</button>
        <span style={{ fontSize: 16, fontWeight: 600 }}>会計</span>
        {activeStaff && <span style={{ fontSize: 13, color: '#aaa', marginLeft: 'auto' }}>{activeStaff.name}</span>}
      </div>

      <div style={{ marginTop: 12, background: '#fff' }}>
        <div style={{ padding: '8px 16px', fontSize: 12, color: '#888', fontWeight: 600 }}>注文明細・商品別割引（商品をタップ）</div>
        {itemDiscountRows.map(({ item, amount, unitPrice, unitDiscount }) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelectedItemId(item.id)}
            style={{ width: '100%', padding: '14px 16px', border: 'none', borderBottom: '1px solid #f5f5f5', background: '#fff', cursor: 'pointer', textAlign: 'left' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#222' }}>{item.productNameSnapshot} × {item.quantity}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>1個 ¥{unitPrice.toLocaleString()}</div>
                {amount > 0 && (
                  <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4, fontWeight: 700 }}>
                    1個 -¥{unitDiscount.toLocaleString()} / 合計 -¥{amount.toLocaleString()}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: amount > 0 ? '#999' : '#222', textDecoration: amount > 0 ? 'line-through' : 'none' }}>¥{item.lineTotal.toLocaleString()}</div>
                {amount > 0 && <div style={{ fontSize: 16, fontWeight: 800, color: '#dc2626', marginTop: 3 }}>¥{(item.lineTotal - amount).toLocaleString()}</div>}
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>タップして割引</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', marginTop: 1, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', fontSize: 15, color: '#888' }}>
        <span>商品小計</span>
        <span>¥{subtotalBeforeItemDiscount.toLocaleString()}</span>
      </div>
      {itemDiscountAmount > 0 && (
        <div style={{ background: '#fff', marginTop: 1, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', fontSize: 15, color: '#dc2626' }}>
          <span>商品別割引</span>
          <span>-¥{itemDiscountAmount.toLocaleString()}</span>
        </div>
      )}

      <div style={{ background: '#fff', marginTop: 1, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#555' }}>会計全体の割引</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: discountType ? 12 : 0 }}>
          <button onClick={() => { setDiscountType(discountType === 'amount' ? null : 'amount'); setDiscountValue('') }} style={{ padding: '7px 14px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: discountType === 'amount' ? '#222' : '#fff', color: discountType === 'amount' ? '#fff' : '#333' }}>金額</button>
          <button onClick={() => { setDiscountType(discountType === 'percent' ? null : 'percent'); setDiscountValue('') }} style={{ padding: '7px 14px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: discountType === 'percent' ? '#222' : '#fff', color: discountType === 'percent' ? '#fff' : '#333' }}>%</button>
        </div>
        {discountType && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder={discountType === 'percent' ? '割引率（%）' : '割引額（円）'} min="0" max={discountType === 'percent' ? '100' : undefined} style={{ width: '100%', padding: '10px 12px', fontSize: 15, border: '1px solid #ddd', borderRadius: 8, boxSizing: 'border-box' }} />
            <input type="text" value={discountNote} onChange={e => setDiscountNote(e.target.value)} placeholder="割引理由（任意）" style={{ width: '100%', padding: '8px 12px', fontSize: 14, border: '1px solid #ddd', borderRadius: 8, boxSizing: 'border-box' }} />
          </div>
        )}
        {discountAmount > 0 && <div style={{ marginTop: 10, color: '#dc2626', fontSize: 14, fontWeight: 600 }}>会計割引 -¥{discountAmount.toLocaleString()}</div>}
      </div>

      <div style={{ background: '#fff', marginTop: 1, padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700 }}>
          <span>合計</span>
          <span>¥{total.toLocaleString()}</span>
        </div>
        {taxAmount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#aaa', marginTop: 4 }}><span>内消費税 {taxRate}%</span><span>¥{taxAmount.toLocaleString()}</span></div>}
      </div>

      <div style={{ background: '#fff', marginTop: 12, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>お預かり金額</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {[1000, 2000, 5000, 10000].map(amt => (
            <button key={amt} onClick={() => setReceivedCash(String(amt))} style={{ padding: '8px 16px', fontSize: 14, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: Number(receivedCash) === amt ? '#222' : '#fff', color: Number(receivedCash) === amt ? '#fff' : '#333' }}>
              ¥{amt.toLocaleString()}
            </button>
          ))}
        </div>
        <input type="number" value={receivedCash} onChange={e => setReceivedCash(e.target.value)} placeholder="金額を入力" style={{ width: '100%', padding: '12px', fontSize: 22, border: '1px solid #ddd', borderRadius: 8, textAlign: 'right', boxSizing: 'border-box' }} />
      </div>

      {change !== null && <div style={{ background: '#f0fdf4', marginTop: 1, padding: '16px', display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 700, color: '#16a34a' }}><span>お釣り</span><span>¥{change.toLocaleString()}</span></div>}
      {receivedCash !== '' && received < total && <div style={{ background: '#fef2f2', marginTop: 1, padding: '12px 16px', fontSize: 14, color: '#dc2626', textAlign: 'center' }}>あと ¥{(total - received).toLocaleString()} 不足しています</div>}

      <div style={{ position: 'fixed', bottom: 74, left: 0, right: 0, padding: '10px 16px', background: '#fff', borderTop: '1px solid #eee', zIndex: 44 }}>
        <button onClick={handleConfirm} disabled={change === null || submitting} style={{ width: '100%', padding: '15px', fontSize: 17, background: change === null ? '#ccc' : '#222', color: '#fff', border: 'none', borderRadius: 10, cursor: change === null ? 'not-allowed' : 'pointer' }}>
          {submitting ? '処理中...' : '会計を確定する'}
        </button>
      </div>
      <StaffBottomNav
        current="checkout"
        tableId={tableId}
        orderId={orderId}
        storeId={storeId}
        guestCount={guestCount}
      />
    </div>
  )
}
