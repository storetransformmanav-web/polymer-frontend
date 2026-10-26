import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const SESSION_KEY = 'polymer-crm:session'
const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString()
const PAST = new Date(Date.now() - 60 * 60 * 1000).toISOString()

const validSession = {
  accessToken: 'token-123',
  expiresAt: FUTURE,
  user: { id: 'u1', email: 'a@b.co', role: 'admin' },
}

/** The slice reads localStorage once at import time, so load a fresh copy per case. */
async function loadSessionFromStorage(stored: string | null) {
  vi.resetModules()
  if (stored === null) window.localStorage.removeItem(SESSION_KEY)
  else window.localStorage.setItem(SESSION_KEY, stored)

  const { authReducer } = await import('./authSlice.ts')
  return authReducer(undefined, { type: 'test/init' }).session
}

describe('restoring a saved session', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => window.localStorage.clear())

  it('restores a well-formed, unexpired session', async () => {
    expect(await loadSessionFromStorage(JSON.stringify(validSession))).toMatchObject({
      accessToken: 'token-123',
    })
  })

  it('has no session when nothing is stored', async () => {
    expect(await loadSessionFromStorage(null)).toBeNull()
  })

  it('drops an expired session', async () => {
    expect(
      await loadSessionFromStorage(JSON.stringify({ ...validSession, expiresAt: PAST })),
    ).toBeNull()
  })

  it.each([
    ['not JSON', '{oops'],
    ['a JSON string', JSON.stringify('token')],
    ['null', 'null'],
    ['an array', '[]'],
    ['no token', JSON.stringify({ ...validSession, accessToken: undefined })],
    ['an empty token', JSON.stringify({ ...validSession, accessToken: '' })],
    ['a non-string token', JSON.stringify({ ...validSession, accessToken: 12345 })],
    ['no expiry', JSON.stringify({ ...validSession, expiresAt: undefined })],
    ['an unparseable expiry', JSON.stringify({ ...validSession, expiresAt: 'someday' })],
    ['no user', JSON.stringify({ ...validSession, user: undefined })],
    [
      'a user without an id',
      JSON.stringify({ ...validSession, user: { role: 'admin' } }),
    ],
  ])('refuses tampered or corrupted storage: %s', async (_label, stored) => {
    // The UI trusts this object, so a hand-edited value must never be accepted.
    expect(await loadSessionFromStorage(stored)).toBeNull()
  })
})

describe('how long a session lasts', () => {
  const NOW = Date.parse('2026-10-20T10:00:00Z')
  const DAY = 24 * 60 * 60 * 1000

  async function sessionExpiry(expiresAt: string, rememberMe = true) {
    vi.resetModules()
    const slice = await import('./authSlice.ts')
    return slice.sessionExpiry(expiresAt, NOW, rememberMe)
  }

  it('is 30 days from signing in (the backend token lasts 30)', async () => {
    const BACKEND_30_DAYS = new Date(NOW + 30 * DAY).toISOString()

    expect(await sessionExpiry(BACKEND_30_DAYS)).toBe(BACKEND_30_DAYS)
  })

  it('never outlasts the backend token, and never goes past 30 days', async () => {
    const SHORT = new Date(NOW + 2 * 60 * 60 * 1000).toISOString()
    expect(await sessionExpiry(SHORT)).toBe(SHORT)

    const LONG = new Date(NOW + 90 * DAY).toISOString()
    expect(await sessionExpiry(LONG)).toBe(new Date(NOW + 30 * DAY).toISOString())
  })

  it('falls back to 30 days when the backend date is unreadable', async () => {
    expect(await sessionExpiry('soon')).toBe(new Date(NOW + 30 * DAY).toISOString())
  })

  it('is the default 1 day without "Remember me", whatever the token says', async () => {
    const LONG = new Date(NOW + 30 * DAY).toISOString()
    expect(await sessionExpiry(LONG, false)).toBe(new Date(NOW + DAY).toISOString())
    expect(await sessionExpiry('soon', false)).toBe(new Date(NOW + DAY).toISOString())
  })
})
