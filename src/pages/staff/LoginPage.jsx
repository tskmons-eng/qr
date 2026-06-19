import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import StaffEmailLoginForm from '../../components/staff/StaffEmailLoginForm'
import StaffGoogleLoginButton from '../../components/staff/StaffGoogleLoginButton'
import { useAuth } from '../../contexts/AuthContext'
import { consumeStaffGoogleRedirectResult, signInStaffWithEmail, signInStaffWithGoogle } from '../../services/staffLoginService'

const GOOGLE_LOGIN_ERROR_MESSAGE = 'Googleログインに失敗しました'
const DEFAULT_LOGIN_REDIRECT = '/admin'
const LOGIN_REDIRECT_STORAGE_KEY = 'staffLoginRedirect'

function isSafeLoginRedirect(next) {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/login')) {
    return false
  }
  return true
}

function getSessionLoginRedirectStorage() {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

function getPersistentLoginRedirectStorage() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function getSavedLoginRedirect() {
  const sessionStorage = getSessionLoginRedirectStorage()
  const savedSessionRedirect = sessionStorage?.getItem(LOGIN_REDIRECT_STORAGE_KEY)
  if (isSafeLoginRedirect(savedSessionRedirect)) return savedSessionRedirect

  const persistentStorage = getPersistentLoginRedirectStorage()
  return persistentStorage?.getItem(LOGIN_REDIRECT_STORAGE_KEY) ?? null
}

function rememberLoginRedirect(next) {
  if (!isSafeLoginRedirect(next)) return
  getSessionLoginRedirectStorage()?.setItem(LOGIN_REDIRECT_STORAGE_KEY, next)
  getPersistentLoginRedirectStorage()?.setItem(LOGIN_REDIRECT_STORAGE_KEY, next)
}

function clearLoginRedirect() {
  getSessionLoginRedirectStorage()?.removeItem(LOGIN_REDIRECT_STORAGE_KEY)
  getPersistentLoginRedirectStorage()?.removeItem(LOGIN_REDIRECT_STORAGE_KEY)
}

function getSafeLoginRedirect(search) {
  const next = new URLSearchParams(search).get('next')
  if (isSafeLoginRedirect(next)) return next

  const savedNext = getSavedLoginRedirect()
  if (isSafeLoginRedirect(savedNext)) return savedNext

  return DEFAULT_LOGIN_REDIRECT
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
    consumeStaffGoogleRedirectResult()
      .then(result => {
        if (!active || !result?.user || result.user.isAnonymous) return
        const redirect = getSafeLoginRedirect(location.search)
        clearLoginRedirect()
        navigate(redirect, { replace: true })
      })
      .catch(event => {
        if (active) setError(GOOGLE_LOGIN_ERROR_MESSAGE)
        console.error('Google redirect sign-in failed:', event)
      })
    return () => { active = false }
  }, [location.search, navigate])

  useEffect(() => {
    if (user && !user.isAnonymous) {
      clearLoginRedirect()
      navigate(loginRedirect, { replace: true })
    }
  }, [loginRedirect, navigate, user])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInStaffWithEmail(email, password)
      clearLoginRedirect()
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
      rememberLoginRedirect(loginRedirect)
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
