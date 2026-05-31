import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { collection, doc, increment, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import StaffBottomNav from '../../components/StaffBottomNav'

function formatOptions(optionSelections) {
  if (!optionSelections || optionSelections.length === 0) return null
  return optionSelections.map(o => o.choice).join(' · ')
}

export default function RemainingPage() {
  const { tableId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [table, setTable] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const activeOrderId = location.state?.orderId ?? table?.currentOrderId ?? null
  const activeStoreId = location.state?.storeId ?? table?.storeId ?? null

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'tables', tableId), snap => {
      if (snap.exists()) setTable({ id: snap.id, ...snap.data() })
      setLoading(false)
    })
    return unsub
  }, [tableId])

  useEffect(() => {
    if (!activeOrderId) {
      setItems([])
      return
    }
    const q = query(collection(db, 'orderItems'), where('orderId', '==', activeOrderId))
    return onSnapshot(q, snap => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(i => i.itemStatus !== 'cancelled')
        .sort((a, b) => (a.orderedAt?.seconds ?? 0) - (b.orderedAt?.seconds ?? 0))
      setItems(data)
    })
  }, [activeOrderId])

  async function markServed(item) {
    if (item.itemStatus !== 'ordered') return
    await updateDoc(doc(db, 'orderItems', item.id), {
      itemStatus: 'served',
      updatedAt: serverTimestamp(),
    })
    await updateDoc(doc(db, 'tables', tableId), {
      pendingCount: increment(-1),
      updatedAt: serverTimestamp(),
    })
  }

  const remainingItems = items.filter(i => i.itemStatus === 'ordered')
  const servedItems = items.filter(i => i.itemStatus === 'served')

  if (loading) return <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>読み込み中...</div>

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 92 }}>
      <div style={{ background: '#fff', padding: '12px 16px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(`/staff/table/${tableId}`)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#444' }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{table?.tableName ?? '席'} の残り</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>未提供 {remainingItems.length}点 / 提供済み {servedItems.length}点</div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ padding: '8px 16px', fontSize: 12, color: '#888', fontWeight: 700 }}>まだ残っているもの</div>
        <div style={{ background: '#fff' }}>
          {remainingItems.map(item => (
            <div key={item.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '13px 16px', borderBottom: '1px solid #f5f5f5' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{item.productNameSnapshot} × {item.quantity}</div>
                {formatOptions(item.optionSelections) && (
                  <div style={{ fontSize: 12, color: '#1d4ed8', marginTop: 3 }}>{formatOptions(item.optionSelections)}</div>
                )}
                <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>{item.orderedBy === 'staff' ? 'スタッフ注文' : 'お客様注文'}</div>
              </div>
              <button onClick={() => markServed(item)} style={{ padding: '8px 12px', fontSize: 13, background: '#222', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
                提供済み
              </button>
            </div>
          ))}
          {remainingItems.length === 0 && (
            <div style={{ textAlign: 'center', padding: 42, color: '#aaa' }}>残っている注文はありません</div>
          )}
        </div>
      </div>

      {servedItems.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ padding: '8px 16px', fontSize: 12, color: '#888', fontWeight: 700 }}>提供済み</div>
          <div style={{ background: '#fff' }}>
            {servedItems.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f5f5f5', opacity: 0.62 }}>
                <span>{item.productNameSnapshot} × {item.quantity}</span>
                <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>提供済み</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <StaffBottomNav
        current="remaining"
        tableId={tableId}
        orderId={activeOrderId}
        storeId={activeStoreId}
        guestCount={table?.guestCount}
        pendingCount={remainingItems.length}
      />
    </div>
  )
}
