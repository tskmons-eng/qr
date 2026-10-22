import { useEffect, useState } from 'react'
import {
  STAFF_PERMISSION_DEFINITIONS,
  describeStaffAccess,
  getStaffRoleDisplay,
  normalizeStaffMemberPermissions,
} from '../../lib/staffPermissions'
import { normalizeStaffCode } from '../../lib/staffMember'
import BottomSheet from '../ui/BottomSheet'
import StaffRoleCards from './StaffRoleCards'

// スタッフの詳細（2026-10-23）。役割はカードで選び、押したらすぐ保存。細かい権限は開いたときだけ。
// パスを決め直す・削除もここから。削除の確認はブラウザの確認窓ではなく、このシートの中で行う。
export default function StaffDetailSheet({ member, isSelf = false, requireCurrentCode, onClose, onPresetChange, onToggle, onCodeReset, onDelete }) {
  const [view, setView] = useState('main')
  const [showDetails, setShowDetails] = useState(false)
  const [currentCode, setCurrentCode] = useState('')
  const [nextCode, setNextCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setView('main')
    setShowDetails(false)
    setCurrentCode('')
    setNextCode('')
    setError('')
  }, [member?.id])

  if (!member) return null
  const role = getStaffRoleDisplay(member)
  const access = describeStaffAccess(member)
  const permissions = normalizeStaffMemberPermissions(member)

  async function run(action) {
    setBusy(true)
    setError('')
    try {
      const failure = await action()
      if (failure) setError(failure)
      return !failure
    } finally {
      setBusy(false)
    }
  }

  async function handleCodeSave(event) {
    event.preventDefault()
    const ok = await run(() => onCodeReset(member, { currentCode, nextCode }))
    if (ok) {
      setView('main')
      setCurrentCode('')
      setNextCode('')
    } else {
      setCurrentCode('')
    }
  }

  const title = view === 'delete' ? `${member.name} を削除しますか？` : member.name

  return (
    <BottomSheet open title={title} onClose={onClose}>
      {view === 'main' && (
        <div className="staff-detail">
          {role.key === 'legacy' && <p className="staff-detail__note">以前の設定（キッチンだけ）です。役割を選ぶと今の形になります。</p>}
          {role.key === 'custom' && <p className="staff-detail__note">役割に当てはまらない個別設定です。役割を選ぶと、その役割の権限に揃います。</p>}
          {/* 自分の権限は自分で変えない（スタッフ管理の権限を自分で外してしまわないように）。 */}
          {isSelf && <p className="staff-detail__note">自分の役割は変えられません。ほかの店長・管理者に変えてもらってください。</p>}
          <StaffRoleCards value={role.key} disabled={busy || isSelf} onChange={key => run(() => onPresetChange(member, key))} />
          <p className="staff-detail__access">
            <b>できること：</b>{access.can.join('・') || 'なし'}
            <br />
            <b>できないこと：</b>{access.cannot.join('・') || 'なし'}
          </p>
          <button type="button" onClick={() => setShowDetails(open => !open)} className="staff-detail__more" aria-expanded={showDetails}>
            細かく変える<span>{showDetails ? '▴' : '▾'}</span>
          </button>
          {showDetails && (
            <div className="staff-detail__toggles">
              {STAFF_PERMISSION_DEFINITIONS.map(definition => (
                <label key={definition.key} className="staff-detail__toggle">
                  <input
                    type="checkbox"
                    checked={permissions[definition.key]}
                    disabled={busy || isSelf}
                    onChange={event => run(() => onToggle(member, definition.key, event.target.checked))}
                  />
                  <span>{definition.label}</span>
                </label>
              ))}
            </div>
          )}
          {error && <p className="staff-sheet-form__error" role="alert">{error}</p>}
          <button type="button" onClick={() => { setView('code'); setError('') }} className="staff-detail__line">
            パスを決め直す<span>›</span>
          </button>
          <button type="button" onClick={() => { setView('delete'); setError('') }} className="staff-detail__line staff-detail__line--danger">
            このスタッフを削除<span>›</span>
          </button>
        </div>
      )}

      {view === 'code' && (
        <form className="staff-sheet-form" onSubmit={handleCodeSave}>
          <div className="staff-sheet-form__row">
            {requireCurrentCode && (
              <label className="staff-sheet-form__field staff-sheet-form__field--pin">
                <span>今のパス</span>
                <input type="password" inputMode="numeric" value={currentCode} onChange={event => { setCurrentCode(normalizeStaffCode(event.target.value)); setError('') }} autoFocus />
              </label>
            )}
            <label className="staff-sheet-form__field staff-sheet-form__field--pin">
              <span>新しいパス（4桁）</span>
              <input type="password" inputMode="numeric" value={nextCode} onChange={event => { setNextCode(normalizeStaffCode(event.target.value)); setError('') }} autoFocus={!requireCurrentCode} />
            </label>
          </div>
          {!requireCurrentCode && <p className="staff-sheet-form__note">店長・オーナーは、今のパスなしで決め直せます（ロック中でも解けます）。</p>}
          {error && <p className="staff-sheet-form__error" role="alert">{error}</p>}
          <div className="staff-sheet-form__buttons">
            <button type="button" onClick={() => setView('main')} className="ui-button ui-button--soft">戻る</button>
            <button type="submit" disabled={busy} className="ui-button ui-button--primary">{busy ? '保存しています...' : 'パスを変える'}</button>
          </div>
        </form>
      )}

      {view === 'delete' && (
        <div className="staff-sheet-form">
          <p className="staff-sheet-form__note">削除すると、この人はどの端末からも入れなくなります。これまでの注文・会計の記録は消えません。</p>
          {error && <p className="staff-sheet-form__error" role="alert">{error}</p>}
          <div className="staff-sheet-form__buttons">
            <button type="button" onClick={() => setView('main')} className="ui-button ui-button--soft">やめる</button>
            <button type="button" disabled={busy} onClick={() => run(() => onDelete(member))} className="ui-button staff-detail__delete">
              {busy ? '削除しています...' : '削除する'}
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  )
}
