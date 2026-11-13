import { useEffect } from 'react'
import {
  idleTimeoutUpdated,
  logout,
  sessionCleared,
  SESSION_ACTIVITY_KEY,
  SESSION_STORAGE_KEY,
} from '../app/store/authSlice.ts'
import { useAppDispatch, useAppSelector } from '../app/store/hooks.ts'
import { lastRequestAt, refreshCsrfSession } from '../lib/api/client.ts'
import { idleTimeoutMs } from '../lib/idleTimeout.ts'

const CHECK_INTERVAL_MS = 30_000
/**
 * The idle limit is **the backend's** (`idle_timeout_minutes`: 1440 — 24 hours — now, kept in the
 * session as `Session.idleTimeoutMinutes`): the person is signed out after that long with nothing
 * done, in any tab. There is no number of minutes in this file.
 */
/**
 * The server counts a session's idle time in *requests* (it cannot see the mouse), while this guard
 * counts mouse and keyboard activity. So when the person is here but the page has made no call for
 * this long, one cheap call (`GET /auth/csrf`) tells the server so — the two timers then agree.
 * (Shorter when the idle limit itself is short, so a ping always lands well before it.)
 */
export const KEEPALIVE_AFTER_MS = 10 * 60_000
/** How often activity is written down for the other tabs (it can come many times a second). */
const RECORD_EVERY_MS = 15_000
/** What counts as the person being there. Background requests and polling do not. */
const ACTIVITY_EVENTS = [
  'pointerdown',
  'pointermove',
  'keydown',
  'wheel',
  'scroll',
] as const

function readLastActivity(): number | null {
  try {
    const stored = Number(window.localStorage.getItem(SESSION_ACTIVITY_KEY))
    return Number.isFinite(stored) && stored > 0 ? stored : null
  } catch {
    return null
  }
}

function writeLastActivity(time: number) {
  try {
    window.localStorage.setItem(SESSION_ACTIVITY_KEY, String(time))
  } catch {
    // localStorage unavailable — this tab's own clock still counts.
  }
}

/**
 * Keeps a signed-in session honest while the app is open:
 *  - signs out when the session passes its `expiresAt` (30 days after signing in with "Remember me", else 1 day),
 *    instead of waiting for the next request to fail — and revokes the token;
 *  - when the session is removed in another tab (logout there), signs out
 *    here too, so one logout really ends the session everywhere.
 *  - signs out after the backend's idle limit (24 hours now) with no activity in any tab, with or
 *    without "Remember me", and revokes the token. The time is kept in localStorage, so it also
 *    catches a browser that was closed and reopened later, and activity in one tab keeps every
 *    other tab signed in.
 *  - while the person is active but the page makes no calls, pings the server every 10 minutes
 *    (`KEEPALIVE_AFTER_MS`) so its idle timer, which counts only requests, agrees with this one.
 *    The ping's answer also carries the limit, so a change on the server is followed.
 * Nothing here signs anyone out because of a server answer: that is only ever a 401 (the API
 * client's response handler).
 * The checks also run the moment a hidden/sleeping tab becomes visible, since browsers throttle
 * timers in background tabs. This is a browser-side limit: the backend should enforce its own.
 */
export function useSessionGuard() {
  const dispatch = useAppDispatch()
  const session = useAppSelector((state) => state.auth.session)

  useEffect(() => {
    if (!session) return undefined

    const expiresAt = Date.parse(session.expiresAt)
    const idleLimitMs = idleTimeoutMs(session.idleTimeoutMinutes)
    const keepAliveAfterMs = Math.min(KEEPALIVE_AFTER_MS, Math.floor(idleLimitMs / 3))
    let lastActivity = readLastActivity()
    if (lastActivity === null) {
      lastActivity = Date.now()
      writeLastActivity(lastActivity)
    }
    let lastWritten = lastActivity

    function recordActivity() {
      lastActivity = Date.now()
      if (lastActivity - lastWritten >= RECORD_EVERY_MS) {
        lastWritten = lastActivity
        writeLastActivity(lastActivity)
      }
    }

    function check() {
      const now = Date.now()
      if (Number.isFinite(expiresAt) && now >= expiresAt) {
        dispatch(logout('expired'))
        return
      }
      // The latest of this tab's activity and what the other tabs wrote down.
      const latest = Math.max(lastActivity ?? 0, readLastActivity() ?? 0)
      if (now - latest >= idleLimitMs) {
        dispatch(logout('idle'))
        return
      }
      // Someone is active but nothing has been asked of the server for a while: let it know. (The
      // request itself resets `lastRequestAt`, so this goes out about every 10 minutes at most; a
      // 401 here ends the session like any other, and a network failure is ignored.) The answer
      // says how long the session may sit idle, so a change of the server's limit is followed.
      if (now - latest < keepAliveAfterMs && now - lastRequestAt() >= keepAliveAfterMs) {
        void refreshCsrfSession()
          .then(({ idleTimeoutMinutes }) => {
            if (idleTimeoutMinutes !== null)
              dispatch(idleTimeoutUpdated(idleTimeoutMinutes))
          })
          .catch(() => undefined)
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
    // `capture`: a component that stops an event, or scrolls its own box, still counts.
    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, recordActivity, { capture: true, passive: true })
    }
    const timer = window.setInterval(check, CHECK_INTERVAL_MS)
    // A browser reopened after the limit is signed out straight away.
    check()

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('storage', handleStorage)
      for (const name of ACTIVITY_EVENTS) {
        window.removeEventListener(name, recordActivity, { capture: true })
      }
      window.clearInterval(timer)
    }
  }, [dispatch, session])
}
