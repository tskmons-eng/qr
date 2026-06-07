import { useEffect, useState } from 'react'
import { loadStaffMembers } from '../../services/staffAuthService'
import { buildStaffPermissionsFromPreset, normalizeStaffPermissions } from '../../lib/staffPermissions'
import { normalizeStaffCode } from '../../lib/staffMember'

export default function StaffLoginScreen({ canOpenStaffAdmin, storeId, onLogin, onLogout, onOpenStaffAdmin }) {
  const [members, setMembers] = useState([])
  const [selected, setSelected] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    loadStaffMembers(storeId).then(nextMembers => {
      if (!active) return
      setMembers(nextMembers)
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
      onLogin({
        id: selected.id,
        name: selected.name,
        permissionPreset: selected.permissionPreset,
        permissions: normalizeStaffPermissions(selected.permissions),
      })
    } else {
      setError('コードが違います')
      setCode('')
    }
  }

  return (
    <div className="staff-login">
      <header className="staff-login__header">
        <h1 className="staff-login__title">スタッフ選択</h1>
        <div className="staff-login__header-actions">
          <button type="button" onClick={onOpenStaffAdmin} className="staff-login__admin-link">
            スタッフ追加
          </button>
          <button type="button" onClick={onLogout} className="staff-login__logout">
            ログアウト
          </button>
        </div>
      </header>

      <div className="staff-login__body">
        {loading ? (
          <p className="staff-login__loading">読み込み中...</p>
        ) : members.length === 0 ? (
          <div className="staff-login__empty">
            <p className="staff-login__empty-title">スタッフが登録されていません</p>
            <p className="staff-login__empty-text">管理画面 → スタッフ から追加してください</p>
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
              onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
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
