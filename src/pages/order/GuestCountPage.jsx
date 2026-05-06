import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useOrder } from '../../contexts/OrderContext'

export default function GuestCountPage() {
  const { table, tableId, storeId, setOrderId, setTable } = useOrder()
  const [count, setCount] = useState(2)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleStart() {
    setLoading(true)
    try {
      const orderRef = await addDoc(collection(db, 'orders'), {
        storeId,
        tableId,
        guestCount: count,
        status: 'open',
        openedAt: serverTimestamp(),
        checkedOutAt: null,
        createdBy: 'customer',
        updatedAt: serverTimestamp(),
      })

      await updateDoc(doc(db, 'tables', tableId), {
        status: 'occupied',
        guestCount: count,
        currentOrderId: orderRef.id,
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      setOrderId(orderRef.id)
      setTable(t => ({ ...t, status: 'occupied', guestCount: count, currentOrderId: orderRef.id }))
      navigate('../menu', { replace: true })
    } catch {
      alert('エラーが発生しました。もう一度試してください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>いらっしゃいませ</h1>
      <p style={{ color: '#888', marginBottom: 48, fontSize: 15 }}>{table.tableName}</p>

      <p style={{ fontSize: 15, marginBottom: 24 }}>何名様ですか？</p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, marginBottom: 48 }}>
        <button
          onClick={() => setCount(c => Math.max(1, c - 1))}
          style={{ width: 48, height: 48, borderRadius: '50%', border: '1px solid #ddd', fontSize: 24, cursor: 'pointer', background: '#fff' }}
        >
          −
        </button>
        <span style={{ fontSize: 48, fontWeight: 700, minWidth: 60 }}>{count}</span>
        <button
          onClick={() => setCount(c => Math.min(20, c + 1))}
          style={{ width: 48, height: 48, borderRadius: '50%', border: '1px solid #ddd', fontSize: 24, cursor: 'pointer', background: '#fff' }}
        >
          ＋
        </button>
      </div>

      <button
        onClick={handleStart}
        disabled={loading}
        style={{ width: '100%', padding: '16px', fontSize: 17, background: '#222', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}
      >
        {loading ? '...' : `${count}名で注文を始める`}
      </button>
    </div>
  )
}
