import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { QRCodeSVG } from 'qrcode.react'
import { db } from '../../lib/firebase'
import { useStore } from '../../contexts/StoreContext'

function generateToken() {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

const statusLabel = { vacant: '空席', occupied: '使用中', checkout_pending: '会計待ち' }

export default function TablePage() {
  const { storeId } = useStore()
  const [tables, setTables] = useState([])
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [qrTarget, setQrTarget] = useState(null)

  useEffect(() => {
    if (!storeId) return
    const q = query(collection(db, 'tables'), where('storeId', '==', storeId))
    return onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      data.sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0))
      setTables(data)
    })
  }, [storeId])

  async function handleAdd(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    await addDoc(collection(db, 'tables'), {
      storeId,
      tableName: newName.trim(),
      qrToken: generateToken(),
      status: 'vacant',
      guestCount: 0,
      currentOrderId: null,
      startedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    setNewName('')
    setAdding(false)
  }

  async function reissueQr(table) {
    if (!confirm(`「${table.tableName}」のQRを再発行しますか？\n古いQRは使えなくなります。`)) return
    await updateDoc(doc(db, 'tables', table.id), {
      qrToken: generateToken(),
      updatedAt: serverTimestamp(),
    })
    setQrTarget(null)
  }

  const baseUrl = window.location.origin

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>席管理</h2>

      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="席名（例: 1番テーブル）"
          style={{ flex: 1, padding: '8px 12px', fontSize: 15, border: '1px solid #ccc', borderRadius: 6 }}
        />
        <button
          type="submit"
          disabled={adding}
          style={{ padding: '8px 16px', background: '#222', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          追加
        </button>
      </form>

      {qrTarget && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setQrTarget(null)}
        >
          <div style={{ background: '#fff', padding: 28, borderRadius: 12, textAlign: 'center', maxWidth: 320 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>{qrTarget.tableName}</h3>
            <QRCodeSVG value={`${baseUrl}/order/${qrTarget.qrToken}`} size={200} />
            <p style={{ fontSize: 11, color: '#aaa', wordBreak: 'break-all', margin: '12px 0' }}>
              {baseUrl}/order/{qrTarget.qrToken}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                onClick={() => reissueQr(qrTarget)}
                style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: '#fff' }}
              >
                QR再発行
              </button>
              <button
                onClick={() => setQrTarget(null)}
                style={{ padding: '8px 20px', fontSize: 13, background: '#222', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tables.map(table => (
          <div key={table.id} style={{ background: '#fff', padding: '12px 16px', borderRadius: 8, border: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{table.tableName}</div>
              <div style={{ fontSize: 13, color: table.status === 'vacant' ? '#16a34a' : '#ca8a04', marginTop: 2 }}>
                {statusLabel[table.status] ?? table.status}
                {table.guestCount > 0 && ` · ${table.guestCount}名`}
              </div>
            </div>
            <button
              onClick={() => setQrTarget(table)}
              style={{ padding: '6px 14px', fontSize: 13, border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', background: '#fff' }}
            >
              QR表示
            </button>
          </div>
        ))}
        {tables.length === 0 && (
          <p style={{ color: '#999', textAlign: 'center', padding: 32 }}>席がまだありません</p>
        )}
      </div>
    </div>
  )
}
