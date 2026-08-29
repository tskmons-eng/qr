import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import AppRouteLoading from './components/AppRouteLoading'

const OrderEntryPage = lazy(() => import('./pages/order/OrderEntryPage'))
const AuthenticatedApp = lazy(() => import('./AuthenticatedApp'))

export default function App() {
  return (
    <Suspense fallback={<AppRouteLoading />}>
      <Routes>
          <Route path="/order/:qrToken/*" element={<OrderEntryPage />} />
          <Route path="*" element={<AuthenticatedApp />} />
      </Routes>
    </Suspense>
  )
}
