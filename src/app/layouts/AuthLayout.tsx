import { Outlet } from 'react-router-dom'

/**
 * Minimal shell for unauthenticated pages (login, password reset, ...).
 * No AppBar/Navbar — those only make sense once a user is signed in.
 */
export function AuthLayout() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6 [background:radial-gradient(circle_at_15%_15%,var(--color-accent-tint),transparent_55%),radial-gradient(circle_at_85%_85%,var(--color-secondary),transparent_45%),var(--color-surface)]">
      <Outlet />
    </div>
  )
}
