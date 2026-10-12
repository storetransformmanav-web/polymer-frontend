import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { googleSignIn, SESSION_STORAGE_KEY } from '../app/store/authSlice.ts'
import { api, type AuthUser } from '../lib/api/endpoints.ts'
import { renderWithProviders } from '../test/renderWithProviders.tsx'
import { IDLE_TIMEOUT_MS, useSessionGuard } from './useSessionGuard.ts'

vi.mock('../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api/endpoints.ts')>()),
  api: { auth: { logout: vi.fn() } },
}))

const MINUTE = 60_000
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
function setup(expiresInMs = 24 * 60 * MINUTE) {
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

  it('signs out after the idle timeout, tells the server, and records why', async () => {
    const store = setup()

    await advance(IDLE_TIMEOUT_MS - 2 * MINUTE)
    expect(auth(store).session).not.toBeNull()

    await advance(3 * MINUTE)
    expect(auth(store).session).toBeNull()
    expect(auth(store).signedOutReason).toBe('idle')
    expect(api.auth.logout).toHaveBeenCalledWith('session-token')
  })

  it('counts user activity: interaction restarts the idle clock', async () => {
    const store = setup()

    await advance(20 * MINUTE)
    act(() => {
      document.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    await advance(20 * MINUTE) // 40 min since sign-in, but only 20 since activity
    expect(auth(store).session).not.toBeNull()

    await advance(11 * MINUTE)
    expect(auth(store).signedOutReason).toBe('idle')
  })

  it('does not sign you out while you are active in another tab', async () => {
    const store = setup()

    await advance(25 * MINUTE)
    // Another tab records activity in shared storage.
    window.localStorage.setItem('polymer-crm:last-activity', String(Date.now()))
    await advance(10 * MINUTE) // 35 min here, but only 10 since the other tab's activity

    expect(auth(store).session).not.toBeNull()
  })

  it('signs out when the token expires, without waiting for a request to fail', async () => {
    const store = setup(2 * MINUTE)

    await advance(MINUTE)
    expect(auth(store).session).not.toBeNull()

    await advance(2 * MINUTE)
    expect(auth(store).session).toBeNull()
    expect(auth(store).signedOutReason).toBe('expired')
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

    await advance(IDLE_TIMEOUT_MS * 2)

    expect(auth(store).session).toBeNull()
    expect(auth(store).signedOutReason).toBeNull()
    expect(api.auth.logout).not.toHaveBeenCalled()
  })
})
