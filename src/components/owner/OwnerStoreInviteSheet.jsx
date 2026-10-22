import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { STORE_NAME_MAX_LENGTH } from '../../lib/storeIdentity'
import { buildStoreInviteUrl } from '../../services/storeOnboardingService'
import BottomSheet from '../ui/BottomSheet'

// 「店舗を追加」と、作った直後・招待を出し直したときの「店長用の招待」（2026-10-22 店舗登録）。
// 入れるのは店舗名だけ。店長はこの QR かリンクから Google でログインして店長になる（メール入力なし）。
export default function OwnerStoreInviteSheet({ mode, result, busy, error, onCreate, onClose }) {
  const [storeName, setStoreName] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (mode === 'create') setStoreName('')
    setCopied(false)
  }, [mode])

  const inviteUrl = result ? buildStoreInviteUrl(result) : ''

  function handleCopy() {
    navigator.clipboard?.writeText(inviteUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <BottomSheet
      open={Boolean(mode)}
      title={mode === 'create' ? '店舗を追加' : '店長用の招待'}
      onClose={onClose}
    >
      {mode === 'create' && (
        <form
          className="owner-invite"
          onSubmit={event => {
            event.preventDefault()
            onCreate(storeName)
          }}
        >
          <label className="owner-invite__field">
            <span>店舗名</span>
            <input
              value={storeName}
              onChange={event => setStoreName(event.target.value)}
              maxLength={STORE_NAME_MAX_LENGTH}
              placeholder="例：やきとり 一番"
              autoFocus
            />
          </label>
          <p className="owner-invite__note">店舗コードは自動で決まります（ほかの店と重なりません）。メールアドレスは要りません。作ると、店長用の招待（QR・リンク）が出ます。</p>
          {error && <p className="owner-invite__error" role="alert">{error}</p>}
          <button type="submit" disabled={busy || !storeName.trim()} className="ui-button ui-button--primary ui-button--block">
            {busy ? '作成中...' : '作成する'}
          </button>
        </form>
      )}
      {mode === 'result' && result && (
        <div className="owner-invite">
          <p className="owner-invite__done">{result.storeName}{result.created ? ' を作りました' : ' の招待を出しました'}</p>
          <div className="owner-invite__code">
            <small>店舗コード（スタッフの端末で使う）</small>
            <strong>{result.storeCode}</strong>
          </div>
          <div className="owner-invite__qr-row">
            <div className="owner-invite__qr"><QRCodeSVG value={inviteUrl} size={112} /></div>
            <p className="owner-invite__qr-text">
              <b>店長用の招待</b>
              店長のスマホでこの QR を読むか、リンクを送ってください。Google でログインすると、この店の店長になります。
              <small>1回だけ・7日間有効。前の招待は使えなくなります。</small>
            </p>
          </div>
          <button type="button" onClick={handleCopy} className="ui-button ui-button--primary ui-button--block">
            {copied ? 'コピーしました' : '招待リンクをコピー'}
          </button>
        </div>
      )}
    </BottomSheet>
  )
}
