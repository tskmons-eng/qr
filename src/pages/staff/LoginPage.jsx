import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import StaffEmailLoginForm from '../../components/staff/StaffEmailLoginForm'
import StaffGoogleLoginButton from '../../components/staff/StaffGoogleLoginButton'
import { useAuth } from '../../contexts/AuthContext'
import { consumeStaffGoogleRedirectResult, signInStaffWithEmail, signInStaffWithGoogle } from '../../services/staffLoginService'

const GOOGLE_LOGIN_ERROR_MESSAGE = 'Googleログインに失敗しました'
const DEFAULT_LOGIN_REDIRECT = '/staff'

function getSafeLoginRedirect(search) {
  const next = new URLSearchParams(search).get('next')
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/login')) {
    return DEFAULT_LOGIN_REDIRECT
  }
  return next
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const loginRedirect = getSafeLoginRedirect(location.search)

  useEffect(() => {
    let active = true
    consumeStaffGoogleRedirectResult().catch(event => {
      if (active) setError(GOOGLE_LOGIN_ERROR_MESSAGE)
      console.error('Google redirect sign-in failed:', event)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (user && !user.isAnonymous) {
      navigate(loginRedirect, { replace: true })
    }
  }, [loginRedirect, navigate, user])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInStaffWithEmail(email, password)
      navigate(loginRedirect)
    } catch {
      setError('メールアドレスまたはパスワードが違います')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError('')
    try {
      await signInStaffWithGoogle()
    } catch (event) {
      console.error('Google sign-in failed:', event)
      setError(GOOGLE_LOGIN_ERROR_MESSAGE)
    }
  }

  return (
    <div className="staff-auth-login">
      <h1 className="staff-auth-login__title">スタッフログイン</h1>
      <StaffGoogleLoginButton disabled={loading} onClick={handleGoogle} />
      <div className="staff-auth-login__divider">
        <span className="staff-auth-login__divider-text">またはメールで</span>
      </div>
      <StaffEmailLoginForm
        email={email}
        error={error}
        loading={loading}
        password={password}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
