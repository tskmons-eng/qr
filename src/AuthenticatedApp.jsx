import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import ApprovalGate from './components/ApprovalGate'
import AppRouteLoading from './components/AppRouteLoading'
import PrivateRoute from './components/PrivateRoute'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { StoreProvider } from './contexts/StoreContext'
import { isSuperAdminEmail } from './lib/ownerIdentity'
import './styles/authenticated.css'

const StaffLayout = lazy(() => import('./pages/staff/StaffLayout'))
const LoginPage = lazy(() => import('./pages/staff/LoginPage'))
const OwnerPage = lazy(() => import('./pages/owner/OwnerPage'))
const StoreInvitePage = lazy(() => import('./pages/StoreInvitePage'))

// 旧「管理画面」(/admin) はスタッフ画面に一本化した（2026-10-22 整理 第3章）。古いブックマークは同じ画面へ案内する。
const ADMIN_TO_STAFF_PATHS = {
  products: '/staff/menu-admin',
  categories: '/staff/menu-admin',
  tables: '/staff/tables',
  staff: '/staff/staff-admin',
  sales: '/staff/sales',
  reservations: '/staff/reservations',
  history: '/staff/history',
  settings: '/staff/settings',
}

function AdminRedirect() {
  const section = (useParams()['*'] ?? '').split('/')[0]
  return <Navigate to={ADMIN_TO_STAFF_PATHS[section] ?? '/staff'} replace />
}

// Google やメールでログインした人は、許可された店長・オーナーだけがスタッフ画面に「管理者」として入れる。
// 店舗コードで入ったスタッフ端末（匿名）は今までどおり。
function StaffRoute() {
  const { user } = useAuth()
  if (user && !user.isAnonymous) {
    return (
      <ApprovalGate>
        <StaffLayout />
      </ApprovalGate>
    )
  }
  return <StaffLayout />
}

function OwnerRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!isSuperAdminEmail(user.email)) return <Navigate to="/staff" replace />
  return children
}

export default function AuthenticatedApp() {
  return (
    <AuthProvider>
      <StoreProvider>
        <Suspense fallback={<AppRouteLoading />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/invite/:inviteId/:token" element={<StoreInvitePage />} />
            <Route path="/owner" element={
              <PrivateRoute>
                <OwnerRoute>
                  <OwnerPage />
                </OwnerRoute>
              </PrivateRoute>
            } />
            <Route path="/staff/*" element={<StaffRoute />} />
            <Route path="/admin/*" element={<AdminRedirect />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </StoreProvider>
    </AuthProvider>
  )
}
