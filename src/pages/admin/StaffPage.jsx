import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useStore } from '../../contexts/StoreContext'

export default function StaffPage() {
  const { storeId } = useStore()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const snap = await getDocs(query(collection(db, 'staffMembers'), where('storeId', '==', storeId)))
    setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0)))
    setLoading(false)
  }

  useEffect(() => { if (storeId) load() }, [storeId])

  async function handleAdd() {
    setError('')
    if (!name.trim()) { setError('名前を入力してください'); return }
    if (!/^\d{4}$/.test(code)) { setError('コードは4桁の数字にしてください'); return }
    setAdding(true)
    await addDoc(collection(db, 'staffMembers'), {
      storeId,
      name: name.trim(),
      code,
      createdAt: serverTimestamp(),
    })
    setName('')
    setCode('')
    await load()
    setAdding(false)
  }

  async function handleDelete(id) {
    if (!confirm('このスタッフを削除しますか？')) return
    await deleteDoc(doc(db, 'staffMembers', id))
    setMembers(prev => prev.filter(m => m.id !== id))
  }

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>スタッフ管理</h2>

      {/* 追加フォーム */}
      <div style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 20, border: '1px solid #eee' }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#555' }}>スタッフを追加</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="名前"
            style={{ flex: 2, minWidth: 120, padding: '9px 12px', fontSize: 14, border: '1px solid #ddd', borderRadius: 8, boxSizing: 'border-box' }}
          />
          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="4桁コード"
            inputMode="numeric"
            style={{ flex: 1, minWidth: 100, padding: '9px 12px', fontSize: 14, border: '1px solid #ddd', borderRadius: 8, boxSizing: 'border-box', letterSpacing: 4, textAlign: 'center' }}
          />
          <button
            onClick={handleAdd}
            disabled={adding}
            style={{ padding: '9px 20px', fontSize: 14, background: '#222', color: '#fff', border: 'none', borderRadius: 8, cursor: adding ? 'default' : 'pointer' }}
          >
            追加
          </button>
        </div>
        {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}
      </div>

      {/* スタッフ一覧 */}
      {loading ? (
        <p style={{ color: '#999', textAlign: 'center', padding: 32 }}>読み込み中...</p>
      ) : members.length === 0 ? (
        <p style={{ color: '#bbb', textAlign: 'center', padding: 32 }}>スタッフが登録されていません</p>
      ) : (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #eee', overflow: 'hidden' }}>
          {members.map((m, i) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: i < members.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
              <div>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{m.name}</span>
                <span style={{ marginLeft: 10, fontSize: 13, color: '#aaa', letterSpacing: 3 }}>{'●'.repeat(4)}</span>
              </div>
              <button
                onClick={() => handleDelete(m.id)}
                style={{ padding: '5px 12px', fontSize: 12, background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer' }}
              >
                削除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
