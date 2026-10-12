import { useAuth } from '../../hooks/useAuth.ts'
import type { AuthUser } from '../../lib/api/endpoints.ts'

export interface CurrentUser {
  name: string
  email: string
  role: string
}

/** "alex.morgan@x.com" → "Alex Morgan": a readable name when the profile has none. */
function nameFromEmail(email: string): string {
  return email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/** Maps the API user to what the sidebar and account menu display. */
export function toCurrentUser(user: AuthUser | null): CurrentUser {
  const email = user?.email ?? ''
  return {
    name: user?.full_name?.trim() || nameFromEmail(email) || 'Signed-in user',
    email,
    role: user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '',
  }
}

/**
 * The signed-in user, for display in the Navbar (sidebar footer) and
 * UserMenu (AppBar dropdown). Both read the same session, so they always
 * agree — and update the moment the session changes.
 */
export function useCurrentUser(): CurrentUser {
  const { user } = useAuth()
  return toCurrentUser(user)
}

export { initials } from '../../lib/format.ts'
