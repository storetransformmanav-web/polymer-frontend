import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { googleSignIn } from '../store/authSlice.ts'
import { createAppStore } from '../store/store.ts'
import { ProtectedRoute } from './ProtectedRoute.tsx'

function renderAt(store = createAppStore()) {
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/products']}>
        <Routes>
          <Route path="/login" element={<p>Login page</p>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/products" element={<p>Products page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Provider>,
  )
  return store
}

describe('ProtectedRoute', () => {
  afterEach(() => window.localStorage.clear())

  it('sends signed-out visitors to the login page', () => {
    renderAt()
    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('Products page')).not.toBeInTheDocument()
  })

  it('renders the page for a signed-in user', () => {
    const store = createAppStore()
    store.dispatch(
      googleSignIn.fulfilled(
        {
          accessToken: 'token',
          expiresAt: '2099-01-01T00:00:00Z',
          user: {
            id: 'u1',
            email: 'a@b.co',
            full_name: 'A',
            phone: null,
            role: 'admin',
            is_active: true,
            last_login_at: null,
          },
        },
        'request-id',
        'credential',
      ),
    )
    renderAt(store)

    expect(screen.getByText('Products page')).toBeInTheDocument()
  })
})
