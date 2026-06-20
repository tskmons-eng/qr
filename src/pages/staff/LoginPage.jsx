import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import StaffEmailLoginForm from '../../components/staff/StaffEmailLoginForm'
import StaffGoogleLoginButton from '../../components/staff/StaffGoogleLoginButton'
import { useAuth } from '../../contexts/AuthContext'
import { consumeStaffGoogleRedirectResult, signInStaffWithEmail, signInStaffWithGoogle } from '../../services/staffLoginService'

const GOOGLE_LOGIN_ERROR_MESSAGE = 'Googleログインに失敗しました'
const GOOGLE_LOGIN_START_MESSAGE = 'Google認証画面を開いています'
const GOOGLE_LOGIN_REDIRECT_MESSAGE = 'Google認証画面へ移動しています。切り替わらない場合はもう一度押してください'
const DEFAULT_LOGIN_REDIRECT = '/admin'
const LOGIN_REDIRECT_STORAGE_KEY = 'staffLoginRedirect'

function isSafeLoginRedirect(next) {
  if (
    !next ||
    !next.startsWith('/') ||
    next.startsWith('//') ||
    next.startsWith('/login') ||
    next === '/staff' ||
    next.startsWith('/staff/')
  ) {
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
  if (savedSessionRedirect) sessionStorage?.removeItem(LOGIN_REDIRECT_STORAGE_KEY)

  const persistentStorage = getPersistentLoginRedirectStorage()
  const savedPersistentRedirect = persistentStorage?.getItem(LOGIN_REDIRECT_STORAGE_KEY)
  if (isSafeLoginRedirect(savedPersistentRedirect)) return savedPersistentRedirect
  if (savedPersistentRedirect) persistentStorage?.removeItem(LOGIN_REDIRECT_STORAGE_KEY)

  return null
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

function getGoogleLoginErrorMessage(error) {
  if (error?.code === 'auth/unauthorized-domain') {
    return 'Googleログインに失敗しました。Firebase Authの承認済みドメイン設定を確認してください。'
  }
  if (error?.code === 'auth/operation-not-allowed') {
    return 'Googleログインに失敗しました。Firebase AuthでGoogleログインが有効か確認してください。'
  }
  if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/popup-closed-by-user') {
    return 'Googleログインに失敗しました。ポップアップが閉じられたため、もう一度押してください。'
  }
  return GOOGLE_LOGIN_ERROR_MESSAGE
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
  const [googleStatus, setGoogleStatus] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)
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
        if (active) setError(getGoogleLoginErrorMessage(event))
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
    setGoogleStatus('')
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
    setGoogleStatus(GOOGLE_LOGIN_START_MESSAGE)
    setGoogleLoading(true)
    try {
      rememberLoginRedirect(loginRedirect)
      const result = await signInStaffWithGoogle()
      if (result?.user && !result.user.isAnonymous) {
        clearLoginRedirect()
        navigate(loginRedirect, { replace: true })
        return
      }
      setGoogleStatus(GOOGLE_LOGIN_REDIRECT_MESSAGE)
    } catch (event) {
      console.error('Google sign-in failed:', event)
      setGoogleStatus('')
      setError(getGoogleLoginErrorMessage(event))
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <div className="staff-auth-login">
      <h1 className="staff-auth-login__title">スタッフログイン</h1>
      <StaffGoogleLoginButton disabled={googleLoading} loading={googleLoading} onClick={handleGoogle} />
      {googleStatus && <p className="staff-auth-login__google-status">{googleStatus}</p>}
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
