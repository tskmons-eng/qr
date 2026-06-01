import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StaffEmailLoginForm from '../../components/staff/StaffEmailLoginForm'
import StaffGoogleLoginButton from '../../components/staff/StaffGoogleLoginButton'
import { signInStaffWithEmail, signInStaffWithGoogle } from '../../services/staffLoginService'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInStaffWithEmail(email, password)
      navigate('/staff')
    } catch {
      setError('メールアドレスまたはパスワードが違います')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setLoading(true)
    try {
      await signInStaffWithGoogle()
      navigate('/staff')
    } catch (event) {
      if (event.code !== 'auth/popup-closed-by-user') {
        setError('Googleログインに失敗しました')
      }
    } finally {
      setLoading(false)
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
