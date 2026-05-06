import { useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { signInAnonymously } from 'firebase/auth'
import { db, auth } from '../../lib/firebase'

export default function StaffEntryPage() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const upper = code.trim().toUpperCase()
    if (upper.length < 6) return
    setLoading(true)
    setError('')
    try {
      if (!auth.currentUser) await signInAnonymously(auth)
      const snap = await getDoc(doc(db, 'storeCodes', upper))
      if (!snap.exists()) {
        setError('店舗コードが正しくありません')
        setLoading(false)
        return
      }
      const { storeId } = snap.data()
      await setDoc(doc(db, 'staffSessions', auth.currentUser.uid), {
        storeId,
        code: upper,
      })
      localStorage.setItem('deviceStoreId', storeId)
      window.location.href = '/staff'
    } catch (err) {
      setError(err?.code || err?.message || 'エラーが発生しました。再度お試しください')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 32, width: '100%', maxWidth: 340, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, textAlign: 'center' }}>スタッフ画面</h1>
        <p style={{ fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 28 }}>店舗コードを入力してください</p>
        <form onSubmit={handleSubmit}>
          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6))}
            placeholder="XXXXXX"
            autoFocus
            autoCapitalize="characters"
            style={{ width: '100%', padding: '14px 12px', fontSize: 26, textAlign: 'center', letterSpacing: 8, border: '2px solid #ddd', borderRadius: 10, boxSizing: 'border-box', fontWeight: 700, marginBottom: 8 }}
          />
          {error && <p style={{ color: '#dc2626', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>{error}</p>}
          <button
            type="submit"
            disabled={code.length < 6 || loading}
            style={{ width: '100%', marginTop: 8, padding: '13px', fontSize: 15, fontWeight: 600, background: code.length === 6 && !loading ? '#222' : '#ccc', color: '#fff', border: 'none', borderRadius: 10, cursor: code.length === 6 && !loading ? 'pointer' : 'default' }}
          >
            {loading ? '確認中...' : '入室する'}
          </button>
        </form>
      </div>
    </div>
  )
}
