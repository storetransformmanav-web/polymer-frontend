import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../../lib/api/endpoints.ts'
import { ApiError } from '../../../lib/api/ApiError.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { LoginForm } from './LoginForm.tsx'

vi.mock('../../../lib/api/endpoints.ts', () => ({
  api: { auth: { requestOtp: vi.fn(), verifyOtp: vi.fn(), logout: vi.fn() } },
}))

const NOTICE = 'If this email belongs to an active user, a login code has been sent.'
const EMAIL = 'admin@polymeruk.com'

const LOGIN_RESPONSE = {
  access_token: 'token-123',
  expires_at: '2099-01-01T00:00:00Z',
  user: {
    id: 'u1',
    email: EMAIL,
    full_name: 'Admin',
    phone: null,
    role: 'admin',
    is_active: true,
    last_login_at: null,
  },
}

async function goToOtpStep(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email address'), EMAIL)
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByRole('heading', { name: 'Check your email' })
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.mocked(api.auth.requestOtp).mockResolvedValue({
      message: NOTICE,
      expires_in_seconds: 600,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  describe('how long signing in lasts', () => {
    const DAY = 24 * 60 * 60 * 1000

    it('has a "Remember me" checkbox on the email step, unticked by default', () => {
      renderWithProviders(<LoginForm />)

      const box = screen.getByRole('checkbox', { name: /remember me/i })
      expect(box).not.toBeChecked()
    })

    it('ticked: asks the backend for a 30-day sign-in and the session lasts 30 days', async () => {
      vi.mocked(api.auth.verifyOtp).mockResolvedValue(LOGIN_RESPONSE)
      const user = userEvent.setup()
      const { store } = renderWithProviders(<LoginForm />)
      await user.click(screen.getByRole('checkbox', { name: /remember me/i }))
      await goToOtpStep(user)
      for (const digit of '123456') await user.keyboard(digit)
      await waitFor(() => expect(store.getState().auth.session).not.toBeNull())

      expect(api.auth.verifyOtp).toHaveBeenCalledWith(EMAIL, '123456', true)
      const left = Date.parse(store.getState().auth.session!.expiresAt) - Date.now()
      expect(left).toBeGreaterThan(30 * DAY - 60_000)
      expect(left).toBeLessThanOrEqual(30 * DAY)
    })

    it('unticked: uses the default session (remember_me false, one day), not 30 days', async () => {
      vi.mocked(api.auth.verifyOtp).mockResolvedValue(LOGIN_RESPONSE)
      const user = userEvent.setup()
      const { store } = renderWithProviders(<LoginForm />)
      await goToOtpStep(user)
      for (const digit of '123456') await user.keyboard(digit)
      await waitFor(() => expect(store.getState().auth.session).not.toBeNull())

      expect(api.auth.verifyOtp).toHaveBeenCalledWith(EMAIL, '123456', false)
      const left = Date.parse(store.getState().auth.session!.expiresAt) - Date.now()
      expect(left).toBeGreaterThan(DAY - 60_000)
      expect(left).toBeLessThanOrEqual(DAY)
    })

    it('keeps the choice when going back to change the email', async () => {
      const user = userEvent.setup()
      renderWithProviders(<LoginForm />)
      await user.click(screen.getByRole('checkbox', { name: /remember me/i }))
      await goToOtpStep(user)
      await user.click(screen.getByRole('button', { name: /use a different email/i }))

      expect(screen.getByRole('checkbox', { name: /remember me/i })).toBeChecked()
    })
  })

  describe('email step', () => {
    it('asks only for an email — there is no password field', () => {
      renderWithProviders(<LoginForm />)

      expect(screen.getByLabelText('Email address')).toBeInTheDocument()
      expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
    })

    it('reveals the Continue button only once an email is entered', async () => {
      const user = userEvent.setup()
      renderWithProviders(<LoginForm />)

      const button = screen.getByRole('button', { name: 'Continue', hidden: true })
      expect(button.closest('[inert]')).not.toBeNull()

      await user.type(screen.getByLabelText('Email address'), 'a')
      expect(button.closest('[inert]')).toBeNull()
    })

    it('rejects a malformed email without calling the API', async () => {
      const user = userEvent.setup()
      renderWithProviders(<LoginForm />)

      await user.type(screen.getByLabelText('Email address'), 'not-an-email')
      await user.click(screen.getByRole('button', { name: 'Continue' }))

      expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address')
      expect(api.auth.requestOtp).not.toHaveBeenCalled()
    })

    it('shows the backend error and stays on the email step when the request fails', async () => {
      vi.mocked(api.auth.requestOtp).mockRejectedValue(
        new ApiError('Unable to reach the server. Check your connection and try again.'),
      )
      const user = userEvent.setup()
      renderWithProviders(<LoginForm />)

      await user.type(screen.getByLabelText('Email address'), EMAIL)
      await user.click(screen.getByRole('button', { name: 'Continue' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Unable to reach the server',
      )
      expect(screen.getByLabelText('Email address')).toBeInTheDocument()
    })

    it('shows the development note and stays on the email step when no active user matches', async () => {
      const DEV_NOTE =
        'No active user with this email (this note only appears in development).'
      vi.mocked(api.auth.requestOtp).mockResolvedValue({
        message: NOTICE,
        expires_in_seconds: 600,
        dev_note: DEV_NOTE,
      })
      const user = userEvent.setup()
      renderWithProviders(<LoginForm />)

      await user.type(screen.getByLabelText('Email address'), EMAIL)
      await user.click(screen.getByRole('button', { name: 'Continue' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(DEV_NOTE)
      expect(screen.getByLabelText('Email address')).toHaveValue(EMAIL)
      expect(
        screen.queryByRole('heading', { name: 'Check your email' }),
      ).not.toBeInTheDocument()

      // Typing again clears the note, ready for another attempt.
      await user.type(screen.getByLabelText('Email address'), 'x')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('requests a code and moves to the code step, showing the backend message', async () => {
      const user = userEvent.setup()
      renderWithProviders(<LoginForm />)

      await goToOtpStep(user)

      expect(api.auth.requestOtp).toHaveBeenCalledWith(EMAIL)
      expect(screen.getByText(NOTICE)).toBeInTheDocument()
      expect(screen.getByText(EMAIL)).toBeInTheDocument()
    })
  })

  describe('code step', () => {
    it('verifies automatically once the sixth digit is entered and stores the session', async () => {
      vi.mocked(api.auth.verifyOtp).mockResolvedValue(LOGIN_RESPONSE)
      const user = userEvent.setup()
      const { store } = renderWithProviders(<LoginForm />)

      await goToOtpStep(user)
      await user.keyboard('123456')

      await waitFor(() =>
        expect(api.auth.verifyOtp).toHaveBeenCalledWith(EMAIL, '123456', false),
      )
      await waitFor(() =>
        expect(store.getState().auth.session).toMatchObject({
          accessToken: 'token-123',
          user: { email: EMAIL },
        }),
      )
    })

    it('accepts a pasted code', async () => {
      vi.mocked(api.auth.verifyOtp).mockResolvedValue(LOGIN_RESPONSE)
      const user = userEvent.setup()
      renderWithProviders(<LoginForm />)

      await goToOtpStep(user)
      await user.paste('654321')

      await waitFor(() =>
        expect(api.auth.verifyOtp).toHaveBeenCalledWith(EMAIL, '654321', false),
      )
    })

    it('shows the backend message for a wrong code and lets the user retry', async () => {
      vi.mocked(api.auth.verifyOtp).mockRejectedValue(
        new ApiError('Invalid or expired code.', { status: 400 }),
      )
      const user = userEvent.setup()
      renderWithProviders(<LoginForm />)

      await goToOtpStep(user)
      await user.keyboard('111111')

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Invalid or expired code.',
      )

      // Boxes are cleared and refocused, ready for another attempt.
      const first = screen.getByLabelText('Digit 1 of 6')
      await waitFor(() => expect(first).toHaveFocus())
      expect(first).toHaveValue('')
    })

    it('goes back to the email step with the email still filled in', async () => {
      const user = userEvent.setup()
      renderWithProviders(<LoginForm />)

      await goToOtpStep(user)
      await user.click(screen.getByRole('button', { name: /use a different email/i }))

      expect(screen.getByLabelText('Email address')).toHaveValue(EMAIL)
    })

    it('offers a resend after a cooldown, not immediately', async () => {
      const user = userEvent.setup()
      renderWithProviders(<LoginForm />)

      await goToOtpStep(user)

      expect(screen.getByText(/Resend in \d+s/)).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Resend code' }),
      ).not.toBeInTheDocument()
    })
  })
})
