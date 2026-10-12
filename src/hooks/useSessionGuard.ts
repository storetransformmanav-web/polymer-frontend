import { useEffect } from 'react'
import { logout, sessionCleared, SESSION_STORAGE_KEY } from '../app/store/authSlice.ts'
import { useAppDispatch, useAppSelector } from '../app/store/hooks.ts'

/** Sign out after this long with no interaction in any open tab. */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000
const CHECK_INTERVAL_MS = 30_000
const ACTIVITY_KEY = 'polymer-crm:last-activity'
const ACTIVITY_WRITE_THROTTLE_MS = 10_000
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const

function readSharedActivity(): number {
  try {
    return Number(window.localStorage.getItem(ACTIVITY_KEY)) || 0
  } catch {
    return 0
  }
}

/**
 * Keeps a signed-in session honest while the app is open:
 *  - signs the user out after `idleTimeoutMs` without any interaction
 *    (activity in *any* tab counts, so a second idle tab can't log you
 *    out of the one you're using);
 *  - signs out when the token passes its `expiresAt`, instead of waiting for
 *    the next request to fail;
 *  - when the session is removed in another tab (logout there), signs out
 *    here too, so one logout really ends the session everywhere.
 * Checks also run the moment a hidden/sleeping tab becomes visible, since
 * browsers throttle timers in background tabs.
 */
export function useSessionGuard(idleTimeoutMs = IDLE_TIMEOUT_MS) {
  const dispatch = useAppDispatch()
  const session = useAppSelector((state) => state.auth.session)

  useEffect(() => {
    if (!session) return undefined

    const expiresAt = Date.parse(session.expiresAt)
    let lastActivity = Date.now()
    let lastShared = 0

    function markActive() {
      const now = Date.now()
      lastActivity = now
      if (now - lastShared >= ACTIVITY_WRITE_THROTTLE_MS) {
        lastShared = now
        try {
          window.localStorage.setItem(ACTIVITY_KEY, String(now))
        } catch {
          // Storage unavailable — this tab's own activity still counts.
        }
      }
    }

    function check() {
      const now = Date.now()
      if (Number.isFinite(expiresAt) && now >= expiresAt) {
        dispatch(sessionCleared('expired'))
        return
      }
      if (now - Math.max(lastActivity, readSharedActivity()) >= idleTimeoutMs) {
        dispatch(logout('idle'))
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

    markActive()
    for (const type of ACTIVITY_EVENTS) {
      document.addEventListener(type, markActive, { passive: true, capture: true })
    }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('storage', handleStorage)
    const timer = window.setInterval(check, CHECK_INTERVAL_MS)

    return () => {
      for (const type of ACTIVITY_EVENTS) {
        document.removeEventListener(type, markActive, { capture: true })
      }
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('storage', handleStorage)
      window.clearInterval(timer)
    }
  }, [dispatch, session, idleTimeoutMs])
}
