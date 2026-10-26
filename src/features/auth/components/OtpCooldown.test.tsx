import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseWaitSeconds } from '../../../app/store/authSlice.ts'
import { ApiError } from '../../../lib/api/ApiError.ts'
import { api } from '../../../lib/api/endpoints.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { LoginForm } from './LoginForm.tsx'

vi.mock('../../../lib/api/endpoints.ts', () => ({
  api: { auth: { requestOtp: vi.fn(), verifyOtp: vi.fn(), logout: vi.fn() } },
}))

const EMAIL = 'admin@example.com'
const SENT = 'If this email belongs to an active user, a login code has been sent.'
const COOLDOWN = 'Please wait 41 seconds before requesting another code.'
const cooldownError = (message = COOLDOWN) => new ApiError(message, { status: 429 })

const requestOtp = vi.mocked(api.auth.requestOtp)

async function submitEmail(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email address'), EMAIL)
  await user.click(screen.getByRole('button', { name: 'Continue' }))
}

describe('parseWaitSeconds', () => {
  it.each([
    ['Please wait 41 seconds before requesting another code.', 41],
    ['Please wait 1 second before requesting another code.', 1],
    ['Please wait 30 sec.', 30],
    ['Try again in 2 minutes.', 120],
    ['Try again in 1 minute', 60],
    ['Wait 5 min', 300],
    ['Too many requests from this network.', null],
    ['Please wait before requesting another code.', null],
    ['Please wait 0 seconds', null],
    ['Please wait 99999 seconds', null], // nonsense values are ignored, not trusted
  ])('reads the wait from %j as %s', (message, expected) => {
    expect(parseWaitSeconds(message)).toBe(expected)
  })
})

describe('requesting a code while one was just sent (backend 429)', () => {
  beforeEach(() => {
    requestOtp.mockResolvedValue({ message: SENT, expires_in_seconds: 600 })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('moves to the code screen with the backend message and an exact timer, instead of an error', async () => {
    requestOtp.mockRejectedValue(cooldownError())
    const user = userEvent.setup()
    renderWithProviders(<LoginForm />)

    await submitEmail(user)

    expect(
      await screen.findByRole('heading', { name: 'Check your email' }),
    ).toBeInTheDocument()
    // The backend's own words are shown, plus what to do about it.
    expect(screen.getByText(new RegExp(COOLDOWN))).toBeInTheDocument()
    expect(
      screen.getByText(/A code you already received is still valid/),
    ).toBeInTheDocument()
    expect(screen.getByText(EMAIL)).toBeInTheDocument()
    // The resend timer counts down from the backend's number, not our default 30s.
    expect(screen.getByText(/Resend in (41|40)s/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText('A new code has been sent.')).not.toBeInTheDocument()
  })

  it('lets the user finish signing in with the code they already have', async () => {
    requestOtp.mockRejectedValue(cooldownError())
    vi.mocked(api.auth.verifyOtp).mockResolvedValue({
      access_token: 'token-123',
      expires_at: '2099-01-01T00:00:00Z',
      user: {
        id: 'u1',
        email: EMAIL,
        full_name: 'Test Admin',
        phone: null,
        role: 'administrator',
        is_active: true,
        last_login_at: null,
      },
    })
    const user = userEvent.setup()
    const { store } = renderWithProviders(<LoginForm />)

    await submitEmail(user)
    await screen.findByRole('heading', { name: 'Check your email' })
    await user.keyboard('123456')

    await waitFor(() =>
      expect(api.auth.verifyOtp).toHaveBeenCalledWith(EMAIL, '123456', false),
    )
    await waitFor(() =>
      expect(store.getState().auth.session?.accessToken).toBe('token-123'),
    )
  })

  it('still shows an error (and stays put) for a 429 with no readable wait, e.g. a general traffic limit', async () => {
    requestOtp.mockRejectedValue(cooldownError('Too many requests from this network.'))
    const user = userEvent.setup()
    renderWithProviders(<LoginForm />)

    await submitEmail(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many requests from this network.',
    )
    expect(
      screen.queryByRole('heading', { name: 'Check your email' }),
    ).not.toBeInTheDocument()
  })

  it('does not treat other failures as a cooldown', async () => {
    requestOtp.mockRejectedValue(
      new ApiError('Unable to reach the server.', { status: 503 }),
    )
    const user = userEvent.setup()
    renderWithProviders(<LoginForm />)

    await submitEmail(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to reach the server.',
    )
    expect(
      screen.queryByRole('heading', { name: 'Check your email' }),
    ).not.toBeInTheDocument()
  })

  it('a normal send still starts the usual 30s resend timer', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginForm />)

    await submitEmail(user)

    expect(await screen.findByText(new RegExp(SENT))).toBeInTheDocument()
    expect(screen.getByText(/Resend in (30|29)s/)).toBeInTheDocument()
  })

  it('on Resend, a cooldown reply keeps the user on the code screen without claiming a new code was sent', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) })
    renderWithProviders(<LoginForm />)

    await submitEmail(user) // first request succeeds
    await screen.findByRole('heading', { name: 'Check your email' })
    await act(() => vi.advanceTimersByTimeAsync(31_000)) // the 30s timer ends
    requestOtp.mockRejectedValueOnce(
      cooldownError('Please wait 12 seconds before requesting another code.'),
    )

    await user.click(screen.getByRole('button', { name: 'Resend code' }))

    expect(await screen.findByText(/Resend in (12|11)s/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(screen.queryByText('A new code has been sent.')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('on Resend, a genuinely new code says so', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) })
    renderWithProviders(<LoginForm />)

    await submitEmail(user)
    await screen.findByRole('heading', { name: 'Check your email' })
    await act(() => vi.advanceTimersByTimeAsync(31_000))

    await user.click(screen.getByRole('button', { name: 'Resend code' }))

    expect(await screen.findByText('A new code has been sent.')).toBeInTheDocument()
  })
})
