import { useState, useEffect } from 'react'
import { collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { db, auth } from '../../lib/firebase'
import { useAuth } from '../../contexts/AuthContext'

export default function OwnerPage() {
  const { user } = useAuth()
  const [allowed, setAllowed] = useState([])
  const [emailInput, setEmailInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    return onSnapshot(collection(db, 'allowedEmails'), snap => {
      setAllowed(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.addedAt?.seconds ?? 0) - (b.addedAt?.seconds ?? 0)))
    })
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    const email = emailInput.trim().toLowerCase()
    if (!email || !email.includes('@')) { setError('正しいメールアドレスを入力してください'); return }
    setAdding(true)
    setError('')
    try {
      await setDoc(doc(db, 'allowedEmails', email), {
        email,
        addedAt: serverTimestamp(),
        addedBy: user.email,
      })
      setEmailInput('')
    } catch {
      setError('追加に失敗しました')
    }
    setAdding(false)
  }

  async function handleRemove(email) {
    await deleteDoc(doc(db, 'allowedEmails', email))
  }

  const cardStyle = {
    background: '#fff',
    border: '1px solid #e5e5e5',
    borderRadius: 10,
    padding: '14px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <header style={{ background: '#111', color: '#fff', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 17 }}>スーパー管理者</h1>
        <button
          onClick={() => signOut(auth)}
          style={{ background: 'none', border: '1px solid #555', color: '#ccc', padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
        >
          ログアウト
        </button>
      </header>

      <div style={{ maxWidth: 680, margin: '24px auto', padding: '0 16px' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>許可するメールアドレス</h2>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
          ここに追加したGoogleアカウントが管理画面にアクセスし、店舗を作成できます。
        </p>

        {/* 追加フォーム */}
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <input
            value={emailInput}
            onChange={e => { setEmailInput(e.target.value); setError('') }}
            placeholder="example@gmail.com"
            type="email"
            style={{ flex: 1, padding: '10px 12px', fontSize: 14, border: '1px solid #ddd', borderRadius: 8, outline: 'none' }}
          />
          <button
            type="submit"
            disabled={adding || !emailInput.trim()}
            style={{ padding: '10px 20px', fontSize: 14, fontWeight: 600, background: adding || !emailInput.trim() ? '#ccc' : '#222', color: '#fff', border: 'none', borderRadius: 8, cursor: adding || !emailInput.trim() ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
          >
            {adding ? '追加中...' : '追加'}
          </button>
        </form>
        {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}

        {/* 一覧 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {allowed.length === 0 && (
            <p style={{ color: '#aaa', textAlign: 'center', marginTop: 32 }}>許可済みのメールアドレスはありません</p>
          )}
          {allowed.map(a => (
            <div key={a.id} style={cardStyle}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{a.email}</div>
                <div style={{ color: '#bbb', fontSize: 12, marginTop: 2 }}>
                  追加日時: {a.addedAt?.toDate?.()?.toLocaleString('ja-JP') ?? ''}
                </div>
              </div>
              <button
                onClick={() => handleRemove(a.email)}
                style={{ padding: '6px 14px', fontSize: 13, border: 'none', borderRadius: 6, cursor: 'pointer', background: '#dc2626', color: '#fff', fontWeight: 600 }}
              >
                削除
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
