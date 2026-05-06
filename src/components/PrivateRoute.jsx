import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function PrivateRoute({ children }) {
  const { user } = useAuth()

  // 認証確認中は何も表示しない
  if (user === undefined) return null

  if (!user) return <Navigate to="/login" replace />

  return children
}
