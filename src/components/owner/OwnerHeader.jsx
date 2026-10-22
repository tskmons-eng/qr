export default function OwnerHeader({ onSignOut }) {
  return (
    <header className="owner-header">
      <h1 className="owner-header__title">運営者</h1>
      <button type="button" onClick={onSignOut} className="ui-button ui-button--ghost">
        ログアウト
      </button>
    </header>
  )
}
