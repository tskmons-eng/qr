import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { StoreProvider } from './contexts/StoreContext'
import OrderEntryPage from './pages/order/OrderEntryPage'
import StaffLayout from './pages/staff/StaffLayout'
import AdminLayout from './pages/admin/AdminLayout'
import KitchenPage from './pages/kitchen/KitchenPage'
import LoginPage from './pages/staff/LoginPage'
import OwnerPage from './pages/owner/OwnerPage'
import PrivateRoute from './components/PrivateRoute'
import ApprovalGate, { OWNER_EMAIL } from './components/ApprovalGate'
import { useAuth } from './contexts/AuthContext'

function OwnerRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.email !== OWNER_EMAIL) return <Navigate to="/staff" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <Routes>
          <Route path="/order/:qrToken/*" element={<OrderEntryPage />} />
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
      </StoreProvider>
    </AuthProvider>
  )
}
