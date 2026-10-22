import { useEffect, useState } from 'react'
import PasscodeKeypad from './PasscodeKeypad'
import StoreCodeEntryForm from './StoreCodeEntryForm'
import useStoreCodeEntry from '../../hooks/useStoreCodeEntry'
import { getStaffRoleShortLabel, normalizeStaffMemberPermissions } from '../../lib/staffPermissions'
import {
  canAutoLoginStaff,
  getStaffAutoLoginPreference,
  normalizeStaffCode,
  saveStaffAutoLoginPreference,
} from '../../lib/staffMember'
import { STAFF_JOINED_BY_QR_KEY } from '../../lib/staffEntry'
import { formatOrderCommandError } from '../../lib/orderCommandErrors'
import { loadStaffMembers } from '../../services/staffAuthService'

function buildStaffLoginPayload(member) {
  return {
    id: member.id,
    name: member.name,
    permissionPreset: member.permissionPreset,
    permissions: normalizeStaffMemberPermissions(member),
  }
}

function getInitial(name) {
  return String(name ?? '').trim().slice(0, 1) || '？'
}

// 店舗コードで入った端末で、スタッフを選んで4桁パスを入れる画面（2026-10-22 すっきり明るい見た目）。
// 店長・オーナーは Google でログインすれば、この画面を通らずに「管理者」として入る。
export default function StaffLoginScreen({ storeId, storeName, onLogin, onLogout, onOpenAdminLogin }) {
  const [members, setMembers] = useState([])
  const [selected, setSelected] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [storeSwitchOpen, setStoreSwitchOpen] = useState(false)
  const storeEntry = useStoreCodeEntry({ currentStoreId: storeId })
  // 二次元コードで入ってきたときだけ、入れたことを知らせる（2026-10-23）。
  const [joinedCode] = useState(() => sessionStorage.getItem(STAFF_JOINED_BY_QR_KEY))

  useEffect(() => {
    let active = true
    setLoading(true)
    loadStaffMembers(storeId).then(async nextMembers => {
      if (!active) return
      const savedPreference = getStaffAutoLoginPreference(storeId)
      const autoLoginMember = nextMembers.find(member => canAutoLoginStaff(member, savedPreference))
      setMembers(nextMembers)
      if (autoLoginMember) {
        try {
          await onLogin(buildStaffLoginPayload(autoLoginMember))
          return
        } catch {
          // 自動で入れなかったときは、選ぶ画面を出して手で入ってもらう。
        }
      }
      setLoading(false)
    }).catch(loadError => {
      if (!active) return
      setError(loadError?.message || 'スタッフ情報の読み込みに失敗しました')
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

  // パスの照合はサーバーで行う（画面はパスを持たない。2026-10-22 第4章 4-B）。
  async function handleVerify(enteredCode) {
    setVerifying(true)
    setError('')
    try {
      await onLogin(buildStaffLoginPayload(selected), enteredCode)
      saveStaffAutoLoginPreference({ storeId, staff: selected })
      sessionStorage.removeItem(STAFF_JOINED_BY_QR_KEY)
    } catch (loginError) {
      // 入れなかったときは必ず理由を出す（以前は画面に何も出ず止まっていた）。
      setError(formatOrderCommandError(loginError, { context: 'staffLogin' }).message)
      setCode('')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="staff-auth staff-auth--with-header">
      <header className="staff-auth__header">
        <span className="staff-auth__header-title">{storeName || 'スタッフログイン'}</span>
        <button type="button" onClick={onLogout} className="ui-button ui-button--ghost">ログアウト</button>
      </header>

      {loading ? (
        <p className="staff-auth__lead">読み込み中...</p>
      ) : members.length === 0 ? (
        <div className="staff-auth__card staff-auth__empty">
          <h1 className="staff-auth__title">スタッフが登録されていません</h1>
          <p className="staff-auth__lead">
            店長が Google でログインして、「店舗管理」の「スタッフ」から追加してください。
          </p>
          {error && <p className="staff-auth__error" role="alert">{error}</p>}
          <button type="button" onClick={onOpenAdminLogin} className="ui-button ui-button--primary ui-button--block">
            店長のログインへ
          </button>
        </div>
      ) : !selected ? (
        <>
          {joinedCode && <p className="staff-auth__joined">✓ 二次元コードで店に入りました（店舗コード {joinedCode}）</p>}
          <div className="staff-auth__brand">
            <p className="staff-auth__lead">あなたは誰ですか？</p>
          </div>
          {error && <p className="staff-auth__error" role="alert">{error}</p>}
          <div className="staff-auth__members">
            {members.map(member => (
              <button
                type="button"
                key={member.id}
                onClick={() => handleSelect(member)}
                className="staff-auth__member"
              >
                <span className="staff-auth__avatar">{getInitial(member.name)}</span>
                <span className="staff-auth__member-name">{member.name}</span>
                <span className="staff-auth__member-role">{getStaffRoleShortLabel(member)}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setStoreSwitchOpen(open => !open)} className="staff-auth__link">
            別の店舗コードで入る
          </button>
          {storeSwitchOpen && (
            <div className="staff-auth__card">
              <p className="staff-auth__card-lead">別の店舗コードを入力して、この端末の店舗を切り替えます。</p>
              <StoreCodeEntryForm entry={storeEntry} submitLabel="この店舗で入る" autoFocus />
            </div>
          )}
        </>
      ) : (
        <>
          <div className="staff-auth__brand">
            <span className="staff-auth__avatar staff-auth__avatar--large">{getInitial(selected.name)}</span>
            <h1 className="staff-auth__title">{selected.name}</h1>
            <p className="staff-auth__lead">{verifying ? '確認中...' : '4桁のパスを入力してください'}</p>
          </div>
          <div className="staff-auth__card">
            {error && <p className="staff-auth__error" role="alert">{error}</p>}
            <PasscodeKeypad
              value={code}
              disabled={verifying}
              onChange={value => { setCode(normalizeStaffCode(value)); setError('') }}
              onComplete={handleVerify}
              onBack={() => setSelected(null)}
            />
          </div>
        </>
      )}
    </div>
  )
}
