import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useStore } from '../../contexts/StoreContext'

export default function CategoryPage() {
  const { storeId } = useStore()
  const [categories, setCategories] = useState([])
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!storeId) return
    const q = query(collection(db, 'categories'), where('storeId', '==', storeId))
    return onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      data.sort((a, b) => a.sortOrder - b.sortOrder)
      setCategories(data)
    })
  }, [storeId])

  async function handleAdd(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    await addDoc(collection(db, 'categories'), {
      storeId,
      name: newName.trim(),
      sortOrder: categories.length,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    setNewName('')
    setAdding(false)
  }

  async function toggleActive(cat) {
    await updateDoc(doc(db, 'categories', cat.id), {
      isActive: !cat.isActive,
      updatedAt: serverTimestamp(),
    })
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>カテゴリー管理</h2>

      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="カテゴリー名"
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {categories.map(cat => (
          <div key={cat.id} style={{ background: '#fff', padding: '12px 16px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #eee' }}>
            <span style={{ fontSize: 15, color: cat.isActive ? '#222' : '#aaa' }}>{cat.name}</span>
            <button
              onClick={() => toggleActive(cat)}
              style={{ padding: '4px 12px', fontSize: 13, border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', background: '#fff', color: cat.isActive ? '#333' : '#aaa' }}
            >
              {cat.isActive ? '表示中' : '非表示'}
            </button>
          </div>
        ))}
        {categories.length === 0 && (
          <p style={{ color: '#999', textAlign: 'center', padding: 32 }}>カテゴリーがまだありません</p>
        )}
      </div>
    </div>
  )
}
