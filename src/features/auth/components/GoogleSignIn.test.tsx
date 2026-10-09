import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from '../../../config/env.ts'
import { api } from '../../../lib/api/endpoints.ts'
import { ApiError } from '../../../lib/api/ApiError.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { loadGoogleIdentity, type GoogleIdentity } from '../utils/googleIdentity.ts'
import { LoginForm } from './LoginForm.tsx'

vi.mock('../../../lib/api/endpoints.ts', () => ({
  api: {
    auth: { requestOtp: vi.fn(), verifyOtp: vi.fn(), google: vi.fn(), logout: vi.fn() },
  },
}))
vi.mock('../utils/googleIdentity.ts', () => ({ loadGoogleIdentity: vi.fn() }))

const CREDENTIAL = 'google-id-token-from-gis'

const LOGIN_RESPONSE = {
  access_token: 'google-token',
  expires_at: '2099-01-01T00:00:00Z',
  user: {
    id: 'u1',
    email: 'admin@polymeruk.com',
    full_name: 'Admin',
    phone: null,
    role: 'admin',
    is_active: true,
    last_login_at: null,
  },
}

/** A stand-in for Google's script that lets the test "click" the button. */
function installFakeGoogle() {
  let callback: (response: { credential: string }) => void = () => undefined
  const fake: GoogleIdentity = {
    initialize: vi.fn((config) => {
      callback = config.callback
    }),
    renderButton: vi.fn((parent: HTMLElement) => {
      parent.setAttribute('data-google-button', 'rendered')
    }),
  }
  vi.mocked(loadGoogleIdentity).mockResolvedValue(fake)
  return { fake, signIn: (credential: string) => callback({ credential }) }
}

describe('GoogleSignIn', () => {
  beforeEach(() => {
    env.googleClientId = 'test-client-id.apps.googleusercontent.com'
  })

  afterEach(() => {
    env.googleClientId = ''
    env.isDev = true
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('is hidden in production when no Google client ID is configured', () => {
    env.googleClientId = ''
    env.isDev = false
    renderWithProviders(<LoginForm />)

    expect(loadGoogleIdentity).not.toHaveBeenCalled()
    expect(screen.queryByText('OR')).not.toBeInTheDocument()
    env.isDev = true
  })

  it('shows a disabled setup hint in development when no client ID is configured', () => {
    env.googleClientId = ''
    renderWithProviders(<LoginForm />)

    expect(loadGoogleIdentity).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeDisabled()
    expect(screen.getByText(/VITE_GOOGLE_CLIENT_ID/)).toBeInTheDocument()
  })

  it('renders Google’s button using the configured client ID', async () => {
    const { fake } = installFakeGoogle()
    renderWithProviders(<LoginForm />)

    await waitFor(() => expect(fake.renderButton).toHaveBeenCalled())
    expect(fake.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: env.googleClientId }),
    )
  })

  it('exchanges the Google credential for a session', async () => {
    vi.mocked(api.auth.google).mockResolvedValue(LOGIN_RESPONSE)
    const { fake, signIn } = installFakeGoogle()
    const { store } = renderWithProviders(<LoginForm />)
    await waitFor(() => expect(fake.renderButton).toHaveBeenCalled())

    signIn(CREDENTIAL)

    await waitFor(() => expect(api.auth.google).toHaveBeenCalledWith(CREDENTIAL))
    await waitFor(() =>
      expect(store.getState().auth.session).toMatchObject({
        accessToken: 'google-token',
        user: { email: 'admin@polymeruk.com' },
      }),
    )
  })

  it('shows the backend message when Google sign-in is rejected', async () => {
    vi.mocked(api.auth.google).mockRejectedValue(
      new ApiError('Google sign-in could not be verified.', { status: 401 }),
    )
    const { fake, signIn } = installFakeGoogle()
    const { store } = renderWithProviders(<LoginForm />)
    await waitFor(() => expect(fake.renderButton).toHaveBeenCalled())

    signIn(CREDENTIAL)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Google sign-in could not be verified.',
    )
    expect(store.getState().auth.session).toBeNull()
  })

  it('falls back to a message when Google’s script cannot load', async () => {
    vi.mocked(loadGoogleIdentity).mockRejectedValue(new Error('blocked'))
    renderWithProviders(<LoginForm />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Google sign-in is unavailable right now',
    )
    // The email flow is still usable.
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
  })
})
