import { useEffect } from 'react'
import { logout, sessionCleared, SESSION_STORAGE_KEY } from '../app/store/authSlice.ts'
import { useAppDispatch, useAppSelector } from '../app/store/hooks.ts'

const CHECK_INTERVAL_MS = 30_000

/**
 * Keeps a signed-in session honest while the app is open:
 *  - signs out when the session passes its `expiresAt` (30 days after signing in with "Remember me", else 1 day),
 *    instead of waiting for the next request to fail — and revokes the token;
 *  - when the session is removed in another tab (logout there), signs out
 *    here too, so one logout really ends the session everywhere.
 * There is no inactivity sign-out: you stay signed in for the 30 days unless you
 * log out. The expiry check also runs the moment a hidden/sleeping tab becomes
 * visible, since browsers throttle timers in background tabs.
 */
export function useSessionGuard() {
  const dispatch = useAppDispatch()
  const session = useAppSelector((state) => state.auth.session)

  useEffect(() => {
    if (!session) return undefined

    const expiresAt = Date.parse(session.expiresAt)

    function check() {
      if (Number.isFinite(expiresAt) && Date.now() >= expiresAt) {
        dispatch(logout('expired'))
      }
    }

    function handleStorage(event: StorageEvent) {
      // `key === null` means localStorage was cleared wholesale.
      const sessionRemoved =
        (event.key === SESSION_STORAGE_KEY || event.key === null) &&
        event.newValue === null
      if (sessionRemoved) dispatch(sessionCleared())
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') check()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('storage', handleStorage)
    const timer = window.setInterval(check, CHECK_INTERVAL_MS)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('storage', handleStorage)
      window.clearInterval(timer)
    }
  }, [dispatch, session])
}
