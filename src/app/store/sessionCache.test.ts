import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api/endpoints.ts')>()),
  api: { auth: { logout: vi.fn() } },
}))

const SESSION = {
  accessToken: 'token-123',
  expiresAt: '2099-01-01T00:00:00Z',
  user: { id: 'u1', role: 'admin', email: 'a@polymer.co' },
}

/**
 * A fresh module graph per test: the auth slice reads the stored session when
 * it first loads, and the store clears *its* copy of the query client — so
 * both must come from the same, freshly loaded graph.
 */
async function loadApp() {
  vi.resetModules()
  const { SESSION_STORAGE_KEY, sessionCleared } = await import('./authSlice.ts')
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(SESSION))
  // The session is read when authSlice loads, so load it again now that one is stored.
  vi.resetModules()
  const [{ createAppStore }, { queryClient }, auth] = await Promise.all([
    import('./store.ts'),
    import('../queryClient.ts'),
    import('./authSlice.ts'),
  ])
  return {
    store: createAppStore(),
    queryClient,
    sessionCleared: auth.sessionCleared ?? sessionCleared,
  }
}

describe('cached server data and the session', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
    vi.resetModules()
  })

  it('is wiped when the session ends, so the next person never sees it', async () => {
    const { store, queryClient, sessionCleared } = await loadApp()
    expect(store.getState().auth.session).not.toBeNull()
    queryClient.setQueryData(['activity', 'list', { page: 1 }], { items: ['secret'] })
    queryClient.setQueryData(['users', { page: 1 }], { items: ['someone'] })

    store.dispatch(sessionCleared('expired'))

    expect(store.getState().auth.session).toBeNull()
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it('is left alone while the session continues', async () => {
    const { store, queryClient } = await loadApp()
    queryClient.setQueryData(['users', { page: 1 }], { items: ['someone'] })

    store.dispatch({ type: 'some/unrelated-action' })

    expect(queryClient.getQueryData(['users', { page: 1 }])).toEqual({
      items: ['someone'],
    })
  })
})
