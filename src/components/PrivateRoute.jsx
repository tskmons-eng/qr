import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function PrivateRoute({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  const next = `${location.pathname}${location.search}${location.hash}`
  const loginPath = `/login?next=${encodeURIComponent(next)}`

  // 認証確認中は何も表示しない
  if (user === undefined) return null

  if (!user || user.isAnonymous) return <Navigate to={loginPath} replace />

  return children
}
