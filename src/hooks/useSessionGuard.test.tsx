import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { googleSignIn, SESSION_STORAGE_KEY } from '../app/store/authSlice.ts'
import { api, type AuthUser } from '../lib/api/endpoints.ts'
import { renderWithProviders } from '../test/renderWithProviders.tsx'
import { useSessionGuard } from './useSessionGuard.ts'

vi.mock('../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api/endpoints.ts')>()),
  api: { auth: { logout: vi.fn() } },
}))

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
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

/** Mounts the guard and signs in; the token expires `expiresInMs` from (fake) now. */
function setup(expiresInMs = 30 * DAY) {
  const { store } = renderWithProviders(<Probe />)
  act(() => {
    store.dispatch(
      googleSignIn.fulfilled(
        {
          accessToken: 'session-token',
          expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
          user: USER,
        },
        'request-id',
        'credential',
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

  it('never signs you out for inactivity — you stay signed in for the whole 30 days', async () => {
    const store = setup(30 * DAY)

    await advance(2 * 60 * MINUTE) // two hours, no interaction at all
    expect(auth(store).session).not.toBeNull()

    await advance(15 * DAY) // two weeks later, still no interaction
    expect(auth(store).session).not.toBeNull()
    expect(auth(store).signedOutReason).toBeNull()
    expect(api.auth.logout).not.toHaveBeenCalled()
  })

  it('signs out, and revokes the token, when the 30 days are over', async () => {
    const store = setup(30 * DAY)

    await advance(29 * DAY)
    expect(auth(store).session).not.toBeNull()

    await advance(2 * DAY)
    expect(auth(store).session).toBeNull()
    expect(auth(store).signedOutReason).toBe('expired')
    expect(api.auth.logout).toHaveBeenCalledWith('session-token')
  })

  it('signs out when the token expires, without waiting for a request to fail', async () => {
    const store = setup(2 * MINUTE)

    await advance(MINUTE)
    expect(auth(store).session).not.toBeNull()

    await advance(2 * MINUTE)
    expect(auth(store).session).toBeNull()
    expect(auth(store).signedOutReason).toBe('expired')
    // The token is revoked too (the app's own limit can be sooner than the backend's).
    expect(api.auth.logout).toHaveBeenCalledWith('session-token')
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
