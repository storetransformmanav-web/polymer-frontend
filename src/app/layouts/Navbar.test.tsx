import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/renderWithProviders.tsx'
import { Navbar } from './Navbar.tsx'

describe('Navbar', () => {
  it('marks the current route as active', () => {
    renderWithProviders(<Navbar />, { route: '/' })

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveClass(
      'navbar__link--active',
    )
    expect(screen.getByRole('link', { name: 'Orders' })).not.toHaveClass(
      'navbar__link--active',
    )
  })

  it('links to every top-level section', () => {
    renderWithProviders(<Navbar />, { route: '/' })

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute(
      'href',
      '/orders',
    )
    expect(screen.getByRole('link', { name: 'Products' })).toHaveAttribute(
      'href',
      '/products',
    )
    expect(screen.getByRole('link', { name: 'Inventory' })).toHaveAttribute(
      'href',
      '/inventory',
    )
  })

  it('can be collapsed and expanded again via the toggle', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Navbar />, { route: '/' })

    const toggle = screen.getByRole('button', { name: 'Collapse sidebar' })
    await user.click(toggle)

    // The toggle must stay reachable once collapsed, or the sidebar
    // could never be expanded again.
    const expandToggle = screen.getByRole('button', { name: 'Expand sidebar' })
    await user.click(expandToggle)
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument()
  })
})
