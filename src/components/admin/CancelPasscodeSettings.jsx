import { useState } from 'react'
import useCancelPasscodeStatus from '../../hooks/useCancelPasscodeStatus'
import { formatOrderCommandError } from '../../lib/orderCommandErrors'
import { CANCEL_PASSCODE_PATTERN, saveCancelPasscode } from '../../services/cancelPasscodeService'

function formatStatusDate(timestamp) {
  const date = timestamp?.toDate?.()
  if (!date) return ''
  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('/', '-')
}

function validatePasscode(passcode, confirmation) {
  if (!CANCEL_PASSCODE_PATTERN.test(passcode)) return 'パスコードは数字4〜8桁で入力してください。'
  if (passcode !== confirmation) return '確認用のパスコードが一致しません。'
  return ''
}

// 下の「設定を保存」とは別に、このボタンだけでサーバーへ保存する（ハッシュにして storeSecrets へ）。
export default function CancelPasscodeSettings({ storeId }) {
  const { status, loaded, reload } = useCancelPasscodeStatus(storeId)
  const [passcode, setPasscode] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    if (saving) return
    const validationError = validatePasscode(passcode, confirmation)
    setError(validationError)
    setSaved(false)
    if (validationError) return
    setSaving(true)
    try {
      await saveCancelPasscode({ storeId, passcode })
      setPasscode('')
      setConfirmation('')
      setSaved(true)
      await reload()
    } catch (saveError) {
      setError(formatOrderCommandError(saveError).message)
    } finally {
      setSaving(false)
    }
  }

  const statusDate = formatStatusDate(status.updatedAt)

  return (
    <>
      <h2 className="admin-settings__heading admin-settings__heading--spaced">取消パスコード</h2>
      <div className="admin-settings__panel admin-settings__passcode-panel">
        <div className="admin-settings__description">
          メニュー管理の権限がないスタッフが、席詳細や厨房で品目を取り消すときに入力します。
          パスコードは店の端末からは読めない場所に保存され、照合はサーバーで行います。
        </div>
        {loaded && (
          status.isSet ? (
            <div className="admin-settings__passcode-status is-set">
              設定済み{statusDate || status.updatedByName ? `（${[statusDate && `${statusDate} 変更`, status.updatedByName].filter(Boolean).join('・')}）` : ''}
            </div>
          ) : (
            <div className="admin-settings__passcode-status is-unset">未設定：今は権限のある人しか取り消せません</div>
          )
        )}
        <div className="admin-settings__passcode-grid">
          <div>
            <label className="admin-settings__passcode-label" htmlFor="cancel-passcode-new">
              {status.isSet ? '変更後のパスコード' : '新しいパスコード'}（数字4〜8桁）
            </label>
            <input
              id="cancel-passcode-new"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={8}
              value={passcode}
              onChange={event => { setPasscode(event.target.value); setSaved(false) }}
              className="admin-settings__store-name-input admin-settings__passcode-input"
              placeholder="••••"
            />
          </div>
          <div>
            <label className="admin-settings__passcode-label" htmlFor="cancel-passcode-confirm">もう一度入力</label>
            <input
              id="cancel-passcode-confirm"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={8}
              value={confirmation}
              onChange={event => { setConfirmation(event.target.value); setSaved(false) }}
              className="admin-settings__store-name-input admin-settings__passcode-input"
              placeholder="••••"
            />
          </div>
        </div>
        {error && <p className="admin-settings__store-name-error">{error}</p>}
        <div className="admin-settings__passcode-actions">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !passcode || !confirmation}
            className={`admin-settings__store-name-save${saved ? ' is-saved' : ''}`}
          >
            {saving ? '保存中...' : saved ? '保存しました' : 'パスコードを保存'}
          </button>
        </div>
        <div className="admin-settings__store-name-help">このボタンだけで保存されます（下の「設定を保存」とは別です）。</div>
      </div>
    </>
  )
}
