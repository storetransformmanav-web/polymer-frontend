import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.ts'

/**
 * Gate for every signed-in page. Without a session the user is sent to
 * /login (remembering where they were headed); an expired token that a
 * request rejects with 401 clears the session, which lands here too.
 */
export function ProtectedRoute() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}
