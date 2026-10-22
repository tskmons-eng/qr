import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { formatOrderCommandError } from '../lib/orderCommandErrors'
import { signInStaffWithGoogle } from '../services/staffLoginService'
import { claimStoreInvite, previewStoreInvite } from '../services/storeOnboardingService'

// 店長用の招待を開いたときの画面（2026-10-22 店舗登録）。押すのは「Google でログインして始める」だけ。
// ログインが済んだら、そのまま店長として登録し、スタッフ画面（はじめの準備）へ進む。
const AUTO_CLAIM_KEY = 'storeInviteAutoClaim'

function formatDeadline(expiresAtMs) {
  if (!expiresAtMs) return ''
  const date = new Date(expiresAtMs)
  return `${date.getMonth() + 1}月${date.getDate()}日まで`
}

export default function StoreInvitePage() {
  const { inviteId, token } = useParams()
  const { user } = useAuth()
  const [invite, setInvite] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const claimStarted = useRef(false)
  const signedInWithGoogle = Boolean(user && !user.isAnonymous)

  useEffect(() => {
    previewStoreInvite({ inviteId, token })
      .then(setInvite)
      .catch(previewError => setError(formatOrderCommandError(previewError, { context: 'storeInvite' }).message))
  }, [inviteId, token])

  async function claim() {
    if (claimStarted.current) return
    claimStarted.current = true
    setBusy(true)
    setError('')
    try {
      await claimStoreInvite({ inviteId, token })
      sessionStorage.removeItem(AUTO_CLAIM_KEY)
      // 店の割り当てを読み直すため、画面を開き直す。
      window.location.assign('/staff')
    } catch (claimError) {
      claimStarted.current = false
      sessionStorage.removeItem(AUTO_CLAIM_KEY)
      setError(formatOrderCommandError(claimError, { context: 'storeInvite' }).message)
      setBusy(false)
    }
  }

  // 「Google でログインして始める」でログインから戻ってきたら、続けて登録する。
  useEffect(() => {
    if (signedInWithGoogle && invite?.status === 'open' && sessionStorage.getItem(AUTO_CLAIM_KEY) === inviteId) claim()
  }, [signedInWithGoogle, invite?.status])

  async function handleStart() {
    if (signedInWithGoogle) {
      claim()
      return
    }
    sessionStorage.setItem(AUTO_CLAIM_KEY, inviteId)
    setBusy(true)
    try {
      await signInStaffWithGoogle()
    } catch {
      sessionStorage.removeItem(AUTO_CLAIM_KEY)
      setError('Google でログインできませんでした。もう一度お試しください')
    } finally {
      setBusy(false)
    }
  }

  const unusable = invite && invite.status !== 'open'

  return (
    <div className="no-store">
      <div className="no-store__icon" aria-hidden="true">🏪</div>
      {!invite && !error && <p className="no-store__lead">招待を確かめています...</p>}
      {invite && (
        <>
          <h1 className="no-store__title">{invite.storeName} の店長になる</h1>
          {unusable ? (
            <p className="no-store__lead">
              {invite.status === 'used' ? 'この招待はもう使われています。' : 'この招待は期限が切れています。'}
              <br />運営者に、招待を出し直してもらってください。
            </p>
          ) : (
            <>
              <p className="no-store__lead">運営者から届いた招待です。<br />Google でログインすると、すぐにこの店の準備を始められます。</p>
              {signedInWithGoogle && <span className="no-store__email">{user.email}</span>}
              <button type="button" onClick={handleStart} disabled={busy} className="ui-button ui-button--primary ui-button--block">
                {busy ? '登録しています...' : signedInWithGoogle ? 'このアカウントで店長になる' : 'Google でログインして始める'}
              </button>
              <p className="no-store__note">この招待は1回だけ使えます（{formatDeadline(invite.expiresAtMs)}）</p>
            </>
          )}
        </>
      )}
      {error && <p className="no-store__error" role="alert">{error}</p>}
    </div>
  )
}
