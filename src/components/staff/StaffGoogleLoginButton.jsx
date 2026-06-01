export default function StaffGoogleLoginButton({ disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="staff-auth-login__google"
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.5 30.2 0 24 0 14.7 0 6.7 5.4 2.8 13.3l7.8 6C12.4 13 17.8 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.6 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 6.9-10 6.9-17z" />
        <path fill="#FBBC05" d="M10.6 28.6A14.8 14.8 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.8-6A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.8 10.7l7.8-6.1z" />
        <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.6 2.2-7.7 2.2-6.2 0-11.5-4.2-13.4-9.9l-7.8 6C6.7 42.6 14.7 48 24 48z" />
      </svg>
      Googleでログイン
    </button>
  )
}
