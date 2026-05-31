import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { signInAnonymously } from 'firebase/auth'
import { db, auth } from '../../lib/firebase'

const SAVED_STORE_CODE_KEY = 'savedStaffStoreCode'

export default function StaffEntryPage() {
  const [code, setCode] = useState('')
  const [rememberCode, setRememberCode] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [autoEntering, setAutoEntering] = useState(false)

  useEffect(() => {
    const savedCode = localStorage.getItem(SAVED_STORE_CODE_KEY)
    if (!savedCode) return
    setCode(savedCode)
    setAutoEntering(true)
    enterStore(savedCode, true).finally(() => setAutoEntering(false))
  }, [])

  async function enterStore(rawCode, remember) {
    const upper = rawCode.trim().toUpperCase()
    if (upper.length < 6) return false

    setLoading(true)
    setError('')
    try {
      const credential = auth.currentUser ? { user: auth.currentUser } : await signInAnonymously(auth)
      const snap = await getDoc(doc(db, 'storeCodes', upper))
      if (!snap.exists()) {
        localStorage.removeItem(SAVED_STORE_CODE_KEY)
        setError('店舗コードが正しくありません')
        setLoading(false)
        return false
      }

      const { storeId } = snap.data()
      await setDoc(doc(db, 'staffSessions', credential.user.uid), {
        storeId,
        code: upper,
      })

      localStorage.setItem('deviceStoreId', storeId)
      if (remember) {
        localStorage.setItem(SAVED_STORE_CODE_KEY, upper)
      } else {
        localStorage.removeItem(SAVED_STORE_CODE_KEY)
      }

      window.location.href = '/staff'
      return true
    } catch (err) {
      setError(err?.code || err?.message || 'エラーが発生しました。もう一度試してください')
      setLoading(false)
      return false
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    await enterStore(code, rememberCode)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 32, width: '100%', maxWidth: 340, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, textAlign: 'center' }}>スタッフ画面</h1>
        <p style={{ fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 28 }}>
          {autoEntering ? '保存済みの店舗コードで入室しています...' : '店舗コードを入力してください'}
        </p>
        <form onSubmit={handleSubmit}>
          <input
            value={code}
            onChange={e => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase())}
            placeholder="XXXXXX"
            autoFocus
            autoCapitalize="characters"
            style={{ width: '100%', padding: '14px 12px', fontSize: 26, textAlign: 'center', letterSpacing: 8, border: '2px solid #ddd', borderRadius: 10, boxSizing: 'border-box', fontWeight: 700, marginBottom: 10 }}
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#555', marginBottom: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={rememberCode}
              onChange={e => setRememberCode(e.target.checked)}
            />
            次回から店舗コード入力を省略する
          </label>

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
