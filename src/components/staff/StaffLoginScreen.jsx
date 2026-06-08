import { useEffect, useState } from 'react'
import { loadStaffMembers } from '../../services/staffAuthService'
import { enterStaffStoreByCode } from '../../services/staffEntryService'
import { buildStaffPermissionsFromPreset, normalizeStaffMemberPermissions } from '../../lib/staffPermissions'
import {
  canEnterStaffStore,
  getSavedStaffStoreCode,
  normalizeStaffStoreCode,
  saveStaffStoreCodePreference,
} from '../../lib/staffEntry'
import {
  canAutoLoginStaff,
  clearStaffAutoLoginPreference,
  getStaffAutoLoginPreference,
  normalizeStaffCode,
  saveStaffAutoLoginPreference,
} from '../../lib/staffMember'

function buildStaffLoginPayload(member) {
  return {
    id: member.id,
    name: member.name,
    permissionPreset: member.permissionPreset,
    permissions: normalizeStaffMemberPermissions(member),
  }
}

export default function StaffLoginScreen({
  canOpenStaffAdmin,
  forceAnonymousStoreEntry = false,
  storeId,
  onLogin,
  onLogout,
  onOpenStaffAdmin,
}) {
  const [members, setMembers] = useState([])
  const [selected, setSelected] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [storeCode, setStoreCode] = useState(() => getSavedStaffStoreCode() ?? '')
  const [rememberStoreCode, setRememberStoreCode] = useState(true)
  const [storeCodeError, setStoreCodeError] = useState('')
  const [storeCodeLoading, setStoreCodeLoading] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    loadStaffMembers(storeId).then(async nextMembers => {
      if (!active) return
      const savedPreference = getStaffAutoLoginPreference(storeId)
      const autoLoginMember = nextMembers.find(member => canAutoLoginStaff(member, savedPreference))
      setMembers(nextMembers)
      if (autoLoginMember) {
        await onLogin(buildStaffLoginPayload(autoLoginMember))
        return
      }
      setLoading(false)
    }).catch(err => {
      if (!active) return
      setError(err?.message || 'スタッフ情報の読み込みに失敗しました')
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [storeId])

  function handleSelect(member) {
    setSelected(member)
    setCode('')
    setError('')
  }

  function handleVerify() {
    if (normalizeStaffCode(String(selected.code ?? '')) === code) {
      saveStaffAutoLoginPreference({ storeId, staff: selected })
      onLogin(buildStaffLoginPayload(selected))
    } else {
      setError('コードが違います')
      setCode('')
    }
  }

  async function handleStoreCodeSubmit(event) {
    event.preventDefault()
    const normalized = normalizeStaffStoreCode(storeCode)
    if (!canEnterStaffStore(normalized)) {
      setStoreCodeError('店舗コードは6文字で入力してください')
      return
    }

    setStoreCodeLoading(true)
    setStoreCodeError('')
    try {
      const result = await enterStaffStoreByCode(normalized, { forceAnonymous: forceAnonymousStoreEntry })
      if (!result.ok) {
        saveStaffStoreCodePreference({ code: normalized, remember: false })
        setStoreCodeError('店舗コードが正しくありません')
        setStoreCodeLoading(false)
        return
      }

      clearStaffAutoLoginPreference(storeId)
      clearStaffAutoLoginPreference(result.storeId)
      localStorage.removeItem('activeStaff')
      localStorage.setItem('deviceStoreId', result.storeId)
      saveStaffStoreCodePreference({ code: normalized, remember: rememberStoreCode })
      window.location.href = '/staff'
    } catch (err) {
      setStoreCodeError(err?.code || err?.message || '店舗コードの確認に失敗しました')
      setStoreCodeLoading(false)
    }
  }

  return (
    <div className="staff-login">
      <header className="staff-login__header">
        <h1 className="staff-login__title">スタッフログイン</h1>
        <div className="staff-login__header-actions">
          <button type="button" onClick={onOpenStaffAdmin} className="staff-login__admin-link">
            スタッフ追加
          </button>
          <button type="button" onClick={onLogout} className="staff-login__logout">
            ログアウト
          </button>
        </div>
      </header>

      <div className="staff-login__body staff-login__body--stack">
        <form className="staff-login__store-code-panel" onSubmit={handleStoreCodeSubmit}>
          <div>
            <div className="staff-login__store-code-title">店舗コードで入室</div>
            <div className="staff-login__store-code-text">別の店舗コードを入力して、この端末の店舗を切り替えられます。</div>
          </div>
          <div className="staff-login__store-code-row">
            <input
              value={storeCode}
              onChange={event => setStoreCode(normalizeStaffStoreCode(event.target.value))}
              placeholder="ABC123"
              autoCapitalize="characters"
              className="staff-login__store-code-input"
            />
            <button
              type="submit"
              disabled={!canEnterStaffStore(storeCode) || storeCodeLoading}
              className="staff-login__store-code-submit"
            >
              {storeCodeLoading ? '確認中' : '入室'}
            </button>
          </div>
          <label className="staff-login__store-code-remember">
            <input
              type="checkbox"
              checked={rememberStoreCode}
              onChange={event => setRememberStoreCode(event.target.checked)}
            />
            次回から店舗コード入力を省略する
          </label>
          {storeCodeError && <p className="staff-login__error staff-login__store-code-error">{storeCodeError}</p>}
        </form>

        {loading ? (
          <p className="staff-login__loading">読み込み中...</p>
        ) : members.length === 0 ? (
          <div className="staff-login__empty">
            <p className="staff-login__empty-title">スタッフが登録されていません</p>
            <p className="staff-login__empty-text">管理画面のスタッフ管理から追加してください。</p>
            <button
              type="button"
              onClick={onOpenStaffAdmin}
              className="staff-login__secondary"
            >
              {canOpenStaffAdmin ? 'スタッフを追加する' : '管理者ログインへ'}
            </button>
            <button
              type="button"
              onClick={() => onLogin({
                id: 'admin',
                name: '管理者',
                permissionPreset: 'manager',
                permissions: buildStaffPermissionsFromPreset('manager'),
              })}
              className="staff-login__primary"
            >
              管理者として入る
            </button>
          </div>
        ) : !selected ? (
          <div className="staff-login__member-select">
            <p className="staff-login__question">あなたは誰ですか？</p>
            <div className="staff-login__member-list">
              {members.map(member => (
                <button
                  type="button"
                  key={member.id}
                  onClick={() => handleSelect(member)}
                  className="staff-login__member-button"
                >
                  {member.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="staff-login__code-card">
            <p className="staff-login__selected-name">{selected.name}</p>
            <p className="staff-login__code-help">4桁コードを入力</p>
            <input
              type="password"
              inputMode="numeric"
              value={code}
              onChange={event => setCode(normalizeStaffCode(event.target.value))}
              onKeyDown={event => event.key === 'Enter' && code.length === 4 && handleVerify()}
              placeholder="----"
              autoFocus
              className="staff-login__code-input"
            />
            {error && <p className="staff-login__error">{error}</p>}
            <button
              type="button"
              onClick={handleVerify}
              disabled={code.length !== 4}
              className="staff-login__verify"
            >
              確認
            </button>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="staff-login__back"
            >
              戻る
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
