import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { db, auth } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'

export const OWNER_EMAIL = 'tsk.mons@gmail.com'

export default function ApprovalGate({ children }) {
  const { user } = useAuth()
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    if (!user) return
    if (user.email === OWNER_EMAIL) { setStatus('approved'); return }

    async function check() {
      const snap = await getDoc(doc(db, 'allowedEmails', user.email))
      setStatus(snap.exists() ? 'approved' : 'denied')
    }
    check()
  }, [user])

  if (status === 'checking') return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p style={{ color: '#999' }}>確認中...</p>
    </div>
  )

  if (status === 'denied') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12, padding: 24, background: '#f5f5f5' }}>
      <div style={{ fontSize: 52 }}>🚫</div>
      <h2 style={{ fontSize: 18, margin: 0 }}>アクセスできません</h2>
      <p style={{ color: '#888', textAlign: 'center', fontSize: 14, margin: 0 }}>このメールアドレスは許可されていません</p>
      <p style={{ color: '#bbb', fontSize: 12, margin: 0 }}>{user.email}</p>
      <button
        onClick={() => signOut(auth)}
        style={{ marginTop: 16, padding: '10px 24px', fontSize: 14, background: '#fff', border: '1px solid #ddd', borderRadius: 8, cursor: 'pointer', color: '#666' }}
      >
        ログアウト
      </button>
    </div>
  )

  return children
}
