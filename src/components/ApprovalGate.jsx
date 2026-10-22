import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { isSuperAdminEmail } from '../lib/ownerIdentity'
import { isAllowedEmail } from '../services/authSessionService'
import NoStoreScreen from './NoStoreScreen'

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

  // 許可されていない人には、店が無い人と同じ案内を出す（招待リンクで入る。2026-10-22 店舗登録）。
  if (status === 'denied') return <NoStoreScreen />

  return children
}
