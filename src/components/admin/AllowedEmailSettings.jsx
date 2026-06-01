export default function AllowedEmailSettings({
  allowedEmails,
  newEmail,
  emailAdding,
  emailError,
  onNewEmailChange,
  onAddEmail,
  onRemoveEmail,
}) {
  return (
    <>
      <h2 className="admin-settings__heading admin-settings__heading--owner">管理者・キッチン アクセス許可</h2>
      <div className="admin-settings__panel">
        <div className="admin-settings__description">Googleログインを許可するメールアドレスを管理します。</div>
        <div className="admin-settings__email-form">
          <input
            type="email"
            value={newEmail}
            onChange={event => onNewEmailChange(event.target.value)}
            placeholder="example@gmail.com"
            className="admin-settings__email-input"
          />
          <button
            type="button"
            onClick={onAddEmail}
            disabled={emailAdding}
            className="admin-settings__email-add"
          >
            追加
          </button>
        </div>
        {emailError && <p className="admin-settings__email-error">{emailError}</p>}
        {allowedEmails.length === 0 ? (
          <p className="admin-settings__email-empty">許可されたメールアドレスはありません</p>
        ) : (
          <div className="admin-settings__email-list">
            {allowedEmails.map(email => (
              <div key={email} className="admin-settings__email-row">
                <span className="admin-settings__email">{email}</span>
                <button
                  type="button"
                  onClick={() => onRemoveEmail(email)}
                  className="admin-settings__email-remove"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
