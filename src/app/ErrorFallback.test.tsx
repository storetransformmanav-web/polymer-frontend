import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from '../config/env.ts'
import { AppErrorBoundary } from './AppErrorBoundary.tsx'
import { RouteErrorPage } from './router/RouteErrorPage.tsx'

const SECRET_DETAIL = 'TypeError: cannot read secret.internal.path of undefined'

function Crash(): never {
  throw new Error(SECRET_DETAIL)
}

describe('crash handling', () => {
  beforeEach(() => {
    // React logs caught render errors; keep the test output readable.
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    env.isDev = true
    vi.restoreAllMocks()
  })

  describe('AppErrorBoundary', () => {
    it('renders its children normally', () => {
      render(
        <AppErrorBoundary>
          <p>All good</p>
        </AppErrorBoundary>,
      )
      expect(screen.getByText('All good')).toBeInTheDocument()
    })

    it('shows a friendly page instead of a blank screen, and hides the technical error in production', () => {
      env.isDev = false
      render(
        <AppErrorBoundary>
          <Crash />
        </AppErrorBoundary>,
      )

      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
      expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute(
        'href',
        '/',
      )
      // No message, class name or stack trace reaches the page.
      expect(document.body).not.toHaveTextContent(SECRET_DETAIL)
      expect(document.body).not.toHaveTextContent('TypeError')
    })

    it('shows the error text in development to help debugging', () => {
      env.isDev = true
      render(
        <AppErrorBoundary>
          <Crash />
        </AppErrorBoundary>,
      )
      expect(screen.getByRole('alert')).toHaveTextContent(SECRET_DETAIL)
    })
  })

  describe('RouteErrorPage', () => {
    function renderRoute(element: React.ReactNode, loader?: () => never) {
      const router = createMemoryRouter(
        [{ path: '/', element, loader, errorElement: <RouteErrorPage /> }],
        { initialEntries: ['/'] },
      )
      return render(<RouterProvider router={router} />)
    }

    it('says "Something went wrong" — not "Page not found" — when a page crashes', () => {
      env.isDev = false
      renderRoute(<Crash />)

      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
      expect(screen.queryByText('Page not found')).not.toBeInTheDocument()
      expect(document.body).not.toHaveTextContent(SECRET_DETAIL)
    })

    it('still shows "Page not found" for a genuine 404', async () => {
      renderRoute(<p>never shown</p>, () => {
        throw new Response('Not Found', { status: 404 })
      })

      expect(await screen.findByText('Page not found')).toBeInTheDocument()
    })
  })
})
