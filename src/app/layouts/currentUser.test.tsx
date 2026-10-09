import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/renderWithProviders.tsx'
import type { AuthUser } from '../../lib/api/endpoints.ts'
import { googleSignIn } from '../store/authSlice.ts'
import { Navbar } from './Navbar.tsx'
import { UserMenu } from './UserMenu.tsx'
import { initials, toCurrentUser } from './currentUser.ts'

const USER: AuthUser = {
  id: 'u1',
  email: 'priya.shah@polymeruk.com',
  full_name: 'Priya Shah',
  phone: null,
  role: 'admin',
  is_active: true,
  last_login_at: null,
}

function signIn(store: ReturnType<typeof renderWithProviders>['store'], user: AuthUser) {
  store.dispatch(
    googleSignIn.fulfilled(
      { accessToken: 't', expiresAt: '2099-01-01T00:00:00Z', user },
      'request-id',
      'credential',
    ),
  )
}

describe('toCurrentUser', () => {
  it('uses the profile name, email and a capitalised role', () => {
    expect(toCurrentUser(USER)).toEqual({
      name: 'Priya Shah',
      email: 'priya.shah@polymeruk.com',
      role: 'Admin',
    })
  })

  it('derives a readable name from the email when the profile has none', () => {
    expect(toCurrentUser({ ...USER, full_name: null }).name).toBe('Priya Shah')
    expect(toCurrentUser({ ...USER, full_name: '  ' }).name).toBe('Priya Shah')
  })

  it('copes with a missing email and role', () => {
    expect(toCurrentUser({ ...USER, full_name: null, email: null, role: '' })).toEqual({
      name: 'Signed-in user',
      email: '',
      role: '',
    })
    expect(toCurrentUser(null).name).toBe('Signed-in user')
  })
})

describe('initials', () => {
  it('takes the first letters of up to two words and ignores extra spaces', () => {
    expect(initials('Priya Shah')).toBe('PS')
    expect(initials('  priya   shah  khan ')).toBe('PS')
    expect(initials('Priya')).toBe('P')
  })
})

describe('signed-in user display', () => {
  afterEach(() => window.localStorage.clear())

  it('shows the logged-in user in the sidebar footer', () => {
    const { store } = renderWithProviders(<Navbar />)
    act(() => signIn(store, USER))

    expect(screen.getByText('Priya Shah')).toBeInTheDocument()
    expect(screen.getByText('priya.shah@polymeruk.com')).toBeInTheDocument()
    expect(screen.queryByText('Alex Morgan')).not.toBeInTheDocument()
  })

  it('shows the logged-in user in the account menu', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<UserMenu />)
    act(() => signIn(store, USER))

    await user.click(screen.getByRole('button', { name: /Priya Shah/ }))

    const menu = screen.getByRole('menu')
    expect(menu).toHaveTextContent('Priya Shah')
    expect(menu).toHaveTextContent('priya.shah@polymeruk.com')
    expect(menu).toHaveTextContent('Admin')
  })
})
