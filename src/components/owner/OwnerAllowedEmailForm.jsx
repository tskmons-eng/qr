export default function OwnerAllowedEmailForm({
  adding,
  emailInput,
  error,
  onChange,
  onSubmit,
}) {
  return (
    <>
      <h2 className="owner-content__heading">許可するメールアドレス</h2>
      <p className="owner-content__description">
        ここに追加したGoogleアカウントが管理画面にアクセスし、店舗を作成できます。
      </p>
      <form onSubmit={onSubmit} className="owner-email-form">
        <input
          value={emailInput}
          onChange={event => onChange(event.target.value)}
          placeholder="example@gmail.com"
          type="email"
          className="owner-email-form__input"
        />
        <button
          type="submit"
          disabled={adding || !emailInput.trim()}
          className="owner-email-form__button"
        >
          {adding ? '追加中...' : '追加'}
        </button>
      </form>
      {error && <p className="owner-email-form__error">{error}</p>}
    </>
  )
}
