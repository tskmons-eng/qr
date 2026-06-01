export default function OwnerHeader({ onSignOut }) {
  return (
    <header className="owner-header">
      <h1 className="owner-header__title">スーパー管理者</h1>
      <button type="button" onClick={onSignOut} className="owner-header__logout">
        ログアウト
      </button>
    </header>
  )
}
