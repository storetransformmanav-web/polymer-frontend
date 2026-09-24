import { Outlet } from 'react-router-dom'
import './AuthLayout.css'

/**
 * Minimal shell for unauthenticated pages (login, password reset, ...).
 * No AppBar/Navbar — those only make sense once a user is signed in.
 */
export function AuthLayout() {
  return (
    <div className="auth-layout">
      <Outlet />
    </div>
  )
}
