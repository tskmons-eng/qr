import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ApprovalGate from './components/ApprovalGate'
import AppRouteLoading from './components/AppRouteLoading'
import PrivateRoute from './components/PrivateRoute'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { StoreProvider } from './contexts/StoreContext'
import { isSuperAdminEmail } from './lib/ownerIdentity'
import './styles/authenticated.css'

const StaffLayout = lazy(() => import('./pages/staff/StaffLayout'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const KitchenPage = lazy(() => import('./pages/kitchen/KitchenPage'))
const LoginPage = lazy(() => import('./pages/staff/LoginPage'))
const OwnerPage = lazy(() => import('./pages/owner/OwnerPage'))

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
            <Route path="/owner" element={
              <PrivateRoute>
                <OwnerRoute>
                  <OwnerPage />
                </OwnerRoute>
              </PrivateRoute>
            } />
            <Route path="/staff/*" element={<StaffLayout />} />
            <Route path="/admin/*" element={
              <PrivateRoute>
                <ApprovalGate>
                  <AdminLayout />
                </ApprovalGate>
              </PrivateRoute>
            } />
            <Route path="/kitchen" element={
              <PrivateRoute>
                <ApprovalGate>
                  <KitchenPage />
                </ApprovalGate>
              </PrivateRoute>
            } />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </StoreProvider>
    </AuthProvider>
  )
}
