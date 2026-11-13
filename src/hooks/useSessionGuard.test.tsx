import { act, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  googleSignIn,
  SESSION_ACTIVITY_KEY,
  SESSION_STORAGE_KEY,
} from '../app/store/authSlice.ts'
import { api, type AuthUser } from '../lib/api/endpoints.ts'
import { renderWithProviders } from '../test/renderWithProviders.tsx'
import { useSessionGuard } from './useSessionGuard.ts'

vi.mock('../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api/endpoints.ts')>()),
  api: { auth: { logout: vi.fn() } },
}))

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
/** The limit most tests below give the session (as the backend's `idle_timeout_minutes`). */
const IDLE_LIMIT_MS = 30 * MINUTE
const USER: AuthUser = {
  id: 'u1',
  email: 'a@b.co',
  full_name: 'A',
  phone: null,
  role: 'admin',
  is_active: true,
  last_login_at: null,
}

function Probe() {
  useSessionGuard()
  return null
}

type Store = ReturnType<typeof renderWithProviders>['store']

/**
 * Mounts the guard and signs in; the token expires `expiresInMs` from (fake) now and the backend
 * allows `idleMinutes` of inactivity (`undefined` = the answer did not say: the 1440 default).
 */
function setup(expiresInMs = 30 * DAY, idleMinutes: number | undefined = 30) {
  const { store } = renderWithProviders(<Probe />)
  act(() => {
    store.dispatch(
      googleSignIn.fulfilled(
        {
          expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
          user: USER,
          ...(idleMinutes !== undefined ? { idleTimeoutMinutes: idleMinutes } : {}),
        },
        'request-id',
        { credential: 'credential', nonce: 'test-nonce-0123456789' },
      ),
    )
  })
  return store
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))
const auth = (store: Store) => store.getState().auth

describe('useSessionGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(api.auth.logout).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('follows the limit the backend sent: 40+ idle minutes do not sign anyone out under the 24-hour default', async () => {
    // The answer carried no `idle_timeout_minutes`, so the 1440-minute (24-hour) default applies.
    const store = setup(30 * DAY, undefined)

    await advance(45 * MINUTE)
    expect(auth(store).session).not.toBeNull()
    expect(api.auth.logout).not.toHaveBeenCalled()

    await advance(23 * 60 * MINUTE)
    expect(auth(store).session).toBeNull()
    expect(auth(store).signedOutReason).toBe('idle')
  })

  it('uses any other number of minutes the backend sends', async () => {
    const store = setup(30 * DAY, 90)

    await advance(80 * MINUTE)
    expect(auth(store).session).not.toBeNull()

    await advance(15 * MINUTE)
    expect(auth(store).signedOutReason).toBe('idle')
  })

  it('signs out after the idle limit with no activity, even in a 30-day session, and ends it on the server', async () => {
    const store = setup(30 * DAY)

    await advance(IDLE_LIMIT_MS - MINUTE)
    expect(auth(store).session).not.toBeNull()

    await advance(2 * MINUTE)
    expect(auth(store).session).toBeNull()
    expect(auth(store).signedOutReason).toBe('idle')
    expect(api.auth.logout).toHaveBeenCalled()
  })

  it.each(['pointerDown', 'pointerMove', 'keyDown', 'wheel', 'scroll'] as const)(
    'counts %s as activity, wherever it happens',
    async (eventName) => {
      const store = setup(30 * DAY)

      await advance(20 * MINUTE)
      fireEvent[eventName](document.body)
      await advance(20 * MINUTE)
      expect(auth(store).session).not.toBeNull()

      await advance(11 * MINUTE)
      expect(auth(store).signedOutReason).toBe('idle')
    },
  )

  it('background work does not keep a session alive; activity in another tab does', async () => {
    const store = setup(30 * DAY)

    await advance(20 * MINUTE)
    // What another tab writes down.
    window.localStorage.setItem(SESSION_ACTIVITY_KEY, String(Date.now()))
    await advance(20 * MINUTE)
    expect(auth(store).session).not.toBeNull()

    await advance(11 * MINUTE)
    expect(auth(store).session).toBeNull()
  })

  it('signs out at once when the app opens again after the limit', () => {
    const { store, rerender } = renderWithProviders(<Probe />)
    act(() => {
      store.dispatch(
        googleSignIn.fulfilled(
          {
            expiresAt: new Date(Date.now() + 30 * DAY).toISOString(),
            user: USER,
            idleTimeoutMinutes: 30,
          },
          'request-id',
          { credential: 'credential', nonce: 'test-nonce-0123456789' },
        ),
      )
    })
    rerender(<></>) // closed
    window.localStorage.setItem(
      SESSION_ACTIVITY_KEY,
      String(Date.now() - IDLE_LIMIT_MS - MINUTE),
    )

    rerender(<Probe />) // opened again
    expect(auth(store).session).toBeNull()
    expect(auth(store).signedOutReason).toBe('idle')
  })

  it('a new sign-in starts the idle clock afresh, whatever an old session left behind', () => {
    window.localStorage.setItem(SESSION_ACTIVITY_KEY, '1')
    const store = setup(30 * DAY)
    expect(auth(store).session).not.toBeNull()
  })

  it('forgets the idle clock when the session ends', async () => {
    setup(30 * DAY)
    expect(window.localStorage.getItem(SESSION_ACTIVITY_KEY)).not.toBeNull()

    await advance(IDLE_LIMIT_MS + MINUTE)
    expect(window.localStorage.getItem(SESSION_ACTIVITY_KEY)).toBeNull()
  })

  it('signs out, and revokes the token, when the session is over even though it is in use', async () => {
    const store = setup(50 * MINUTE)

    await advance(25 * MINUTE)
    fireEvent.pointerDown(document.body)
    await advance(20 * MINUTE)
    expect(auth(store).session).not.toBeNull()
    fireEvent.pointerDown(document.body)

    await advance(6 * MINUTE)
    expect(auth(store).session).toBeNull()
    expect(auth(store).signedOutReason).toBe('expired')
    expect(api.auth.logout).toHaveBeenCalled()
  })

  it('signs out when the token expires, without waiting for a request to fail', async () => {
    const store = setup(2 * MINUTE)

    await advance(MINUTE)
    expect(auth(store).session).not.toBeNull()

    await advance(2 * MINUTE)
    expect(auth(store).session).toBeNull()
    expect(auth(store).signedOutReason).toBe('expired')
    // The token is revoked too (the app's own limit can be sooner than the backend's).
    expect(api.auth.logout).toHaveBeenCalled()
  })

  it('signs out here when the session is removed in another tab', () => {
    const store = setup()

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: SESSION_STORAGE_KEY, newValue: null }),
      )
    })

    expect(auth(store).session).toBeNull()
    expect(auth(store).signedOutReason).toBeNull() // a deliberate logout, not a timeout
  })

  it('ignores storage changes that are not the session being removed', () => {
    const store = setup()

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'polymer-crm:theme', newValue: null }),
      )
      window.dispatchEvent(
        new StorageEvent('storage', { key: SESSION_STORAGE_KEY, newValue: '{}' }),
      )
    })

    expect(auth(store).session).not.toBeNull()
  })

  it('does nothing while signed out', async () => {
    const { store } = renderWithProviders(<Probe />)

    await advance(2 * DAY)

    expect(auth(store).session).toBeNull()
    expect(auth(store).signedOutReason).toBeNull()
    expect(api.auth.logout).not.toHaveBeenCalled()
  })
})
