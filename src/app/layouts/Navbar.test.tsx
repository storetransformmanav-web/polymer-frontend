import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '../../test/renderWithProviders.tsx'
import { Navbar } from './Navbar.tsx'

const GROUP = { name: 'Shopify Management' }
const SECTIONS = [
  ['Orders', '/orders'],
  ['Products', '/products'],
  ['Customers', '/customers'],
  ['Inventory', '/inventory'],
] as const

describe('Navbar', () => {
  it('marks the current route as active', () => {
    renderWithProviders(<Navbar />, { route: '/' })

    // NavLink sets aria-current="page" on the active link itself —
    // the semantic signal, rather than asserting a specific class.
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Orders' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('links Dashboard at the top level and every Shopify section inside the group', () => {
    renderWithProviders(<Navbar />, { route: '/' })

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/')
    for (const [label, href] of SECTIONS) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href)
    }
  })

  describe('Shopify Management accordion', () => {
    it('starts closed away from its pages, then opens and closes on click', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Navbar />, { route: '/' })

      const heading = screen.getByRole('button', GROUP)
      const panel = document.getElementById(heading.getAttribute('aria-controls') ?? '')
      expect(heading).toHaveAttribute('aria-expanded', 'false')
      expect(panel).toHaveAttribute('inert')

      await user.click(heading)
      expect(heading).toHaveAttribute('aria-expanded', 'true')
      expect(panel).not.toHaveAttribute('inert')

      await user.click(heading)
      expect(heading).toHaveAttribute('aria-expanded', 'false')
      expect(panel).toHaveAttribute('inert')
    })

    it('is already open on one of its pages, with that link active', () => {
      renderWithProviders(<Navbar />, { route: '/products/abc' })

      expect(screen.getByRole('button', GROUP)).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByRole('link', { name: 'Products' })).toHaveAttribute(
        'aria-current',
        'page',
      )
      expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
        'aria-current',
      )
    })

    it('lets the user close it even on one of its pages', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Navbar />, { route: '/orders' })

      await user.click(screen.getByRole('button', GROUP))

      expect(screen.getByRole('button', GROUP)).toHaveAttribute('aria-expanded', 'false')
    })

    it('stays usable in the collapsed icon rail', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Navbar />, { route: '/' })

      await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }))

      // The heading and links keep their accessible names (labels turn into
      // screen-reader text and tooltips).
      const heading = screen.getByRole('button', GROUP)
      await user.click(heading)
      expect(heading).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByRole('link', { name: 'Customers' })).toHaveAttribute(
        'href',
        '/customers',
      )
    })
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
