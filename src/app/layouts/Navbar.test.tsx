import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { api } from '../../lib/api/endpoints.ts'
import { renderWithProviders } from '../../test/renderWithProviders.tsx'
import { Navbar } from './Navbar.tsx'

vi.mock('../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api/endpoints.ts')>()),
  api: { activity: { list: vi.fn(), actions: vi.fn() }, auth: {} },
}))

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

  it('links User Management at the top level, outside the Shopify group', () => {
    renderWithProviders(<Navbar />, { route: '/users' })

    const users = screen.getByRole('link', { name: 'User Management' })
    expect(users).toHaveAttribute('href', '/users')
    expect(users).toHaveAttribute('aria-current', 'page')
    // Not a Shopify page, so the Shopify group stays closed.
    expect(screen.getByRole('button', GROUP)).toHaveAttribute('aria-expanded', 'false')
  })

  it('links Activity Management at the top level', () => {
    renderWithProviders(<Navbar />, { route: '/activity' })

    const activity = screen.getByRole('link', { name: 'Activity Management' })
    expect(activity).toHaveAttribute('href', '/activity')
    expect(activity).toHaveAttribute('aria-current', 'page')
  })

  it('starts loading the Activity page as soon as its link is hovered or focused', async () => {
    vi.mocked(api.activity.list).mockResolvedValue({
      items: [],
      page: 1,
      page_size: 25,
      total: 0,
      total_pages: 1,
      has_next: false,
    })
    vi.mocked(api.activity.actions).mockResolvedValue([])
    const user = userEvent.setup()
    renderWithProviders(<Navbar />, { route: '/' })
    expect(api.activity.list).not.toHaveBeenCalled()

    await user.hover(screen.getByRole('link', { name: 'Activity Management' }))

    await waitFor(() =>
      expect(api.activity.list).toHaveBeenCalledWith({ page: 1, page_size: 25 }),
    )
    expect(api.activity.actions).toHaveBeenCalled()
    // Other links don't trigger any loading.
    await user.hover(screen.getByRole('link', { name: 'Dashboard' }))
    expect(api.activity.list).toHaveBeenCalledTimes(1)
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
