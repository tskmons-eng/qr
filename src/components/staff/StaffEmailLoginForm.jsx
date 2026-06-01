export default function StaffEmailLoginForm({
  email,
  error,
  loading,
  password,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit}>
      <div className="staff-auth-login__field">
        <label className="staff-auth-login__label">メールアドレス</label>
        <input
          type="email"
          value={email}
          onChange={event => onEmailChange(event.target.value)}
          required
          className="staff-auth-login__input"
        />
      </div>
      <div className="staff-auth-login__field staff-auth-login__field--password">
        <label className="staff-auth-login__label">パスワード</label>
        <input
          type="password"
          value={password}
          onChange={event => onPasswordChange(event.target.value)}
          required
          className="staff-auth-login__input"
        />
      </div>
      {error && <p className="staff-auth-login__error">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="staff-auth-login__submit"
      >
        {loading ? '...' : 'ログイン'}
      </button>
    </form>
  )
}
