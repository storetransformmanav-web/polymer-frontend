import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { sessionCleared } from '../../../app/store/authSlice.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { LoginForm } from './LoginForm.tsx'

describe('sign-out notice on the login form', () => {
  it('shows nothing for a normal visit', () => {
    renderWithProviders(<LoginForm />)
    expect(screen.queryByText(/signed out|session has expired/i)).not.toBeInTheDocument()
  })

  it('explains an automatic sign-out when the session has expired', () => {
    const { store } = renderWithProviders(<LoginForm />)

    act(() => {
      store.dispatch(sessionCleared('expired'))
    })

    expect(screen.getByRole('status')).toHaveTextContent(
      'Your session has expired. Please sign in again.',
    )
  })

  it('goes away as soon as the user starts signing in again', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<LoginForm />)
    act(() => {
      store.dispatch(sessionCleared('expired'))
    })
    expect(screen.getByRole('status')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Email address'), 'a')

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(store.getState().auth.signedOutReason).toBeNull()
  })

  it('is not shown after a deliberate logout', () => {
    const { store } = renderWithProviders(<LoginForm />)

    act(() => {
      store.dispatch(sessionCleared())
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
