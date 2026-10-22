import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { isSuperAdminEmail } from '../lib/ownerIdentity'
import { signOutCurrentUser } from '../services/authSessionService'

// Google でログインしたが、店が割り当てられていない人の画面（2026-10-22 店舗登録）。
// 店は運営者が作り、店長は招待リンクで入る。画面から店を自動で作ることはしない。
export default function NoStoreScreen() {
  const { user } = useAuth()
  const isOperator = isSuperAdminEmail(user?.email)

  return (
    <div className="no-store">
      <div className="no-store__icon" aria-hidden="true">🏪</div>
      <h1 className="no-store__title">店舗がまだありません</h1>
      {isOperator ? (
        <p className="no-store__lead">運営者の画面から店舗を追加してください。</p>
      ) : (
        <p className="no-store__lead">このアカウントには、まだ店舗がありません。<br />運営者から届いた招待リンクを開いてください。</p>
      )}
      {user?.email && <span className="no-store__email">{user.email}</span>}
      {isOperator && <Link to="/owner" className="ui-button ui-button--primary ui-button--block">運営者の画面へ</Link>}
      <button type="button" onClick={signOutCurrentUser} className="ui-button ui-button--ghost ui-button--block">
        別のアカウントでログイン
      </button>
    </div>
  )
}
