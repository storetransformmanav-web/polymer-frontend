import { useAppDispatch, useAppSelector } from '../app/store/hooks.ts'
import { logout } from '../app/store/authSlice.ts'

/**
 * The signed-in session, backed by the `auth` Redux slice (persisted to
 * localStorage in store.ts). Components use this instead of importing the
 * slice, so the state mechanism can change without touching them.
 */
export function useAuth() {
  const session = useAppSelector((state) => state.auth.session)
  const dispatch = useAppDispatch()

  return {
    session,
    user: session?.user ?? null,
    isAuthenticated: session !== null,
    logout: () => dispatch(logout()),
  }
}
