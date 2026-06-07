import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { isSuperAdminEmail } from '../lib/ownerIdentity'
import { isAllowedEmail, signOutCurrentUser } from '../services/authSessionService'

export default function ApprovalGate({ children }) {
  const { user } = useAuth()
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    if (!user) return
    if (isSuperAdminEmail(user.email)) { setStatus('approved'); return }

    async function check() {
      setStatus(await isAllowedEmail(user.email) ? 'approved' : 'denied')
    }
    check()
  }, [user])

  if (status === 'checking') return (
    <div className="approval-gate">
      <p className="approval-gate__loading">確認中...</p>
    </div>
  )

  if (status === 'denied') return (
    <div className="approval-gate-denied">
      <div className="approval-gate-denied__icon">🚫</div>
      <h2 className="approval-gate-denied__title">アクセスできません</h2>
      <p className="approval-gate-denied__message">このメールアドレスは許可されていません</p>
      <p className="approval-gate-denied__email">{user.email}</p>
      <p className="approval-gate-denied__help">↑ このメールを設定画面で許可してください</p>
      <button
        type="button"
        onClick={signOutCurrentUser}
        className="approval-gate-denied__logout"
      >
        ログアウト
      </button>
    </div>
  )

  return children
}
