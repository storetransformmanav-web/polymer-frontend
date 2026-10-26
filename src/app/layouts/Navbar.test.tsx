import { screen, within } from '@testing-library/react'
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

  it('makes no request when a link is hovered or focused: a page loads when it is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Navbar />, { route: '/' })

    await user.hover(screen.getByRole('link', { name: 'Activity Management' }))
    await user.hover(screen.getByRole('link', { name: 'Orders' }))
    await user.hover(screen.getByRole('link', { name: 'Products' }))
    await user.hover(screen.getByRole('link', { name: 'Customers' }))
    screen.getByRole('link', { name: 'Activity Management' }).focus()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(api.activity.list).not.toHaveBeenCalled()
    expect(api.activity.actions).not.toHaveBeenCalled()
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
  })

  describe('Shopify Management in the collapsed icon rail', () => {
    async function collapse(route = '/') {
      const user = userEvent.setup()
      renderWithProviders(<Navbar />, { route })
      await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
      return user
    }

    it('is one icon with its pages hidden until it is clicked', async () => {
      await collapse()

      expect(screen.getByRole('button', GROUP)).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByRole('link', { name: 'Customers' })).not.toBeInTheDocument()
    })

    it('opens a card beside the rail with the group name and every page', async () => {
      const user = await collapse()
      await user.click(screen.getByRole('button', GROUP))

      expect(screen.getByRole('button', GROUP)).toHaveAttribute('aria-expanded', 'true')
      const card = screen.getByRole('group', GROUP)
      expect(card).toHaveTextContent('Shopify Management')
      for (const [label, href] of SECTIONS) {
        expect(within(card).getByRole('link', { name: label })).toHaveAttribute(
          'href',
          href,
        )
      }
    })

    it('marks the current page in the card', async () => {
      const user = await collapse('/products/abc')
      await user.click(screen.getByRole('button', GROUP))

      expect(
        within(screen.getByRole('group', GROUP)).getByRole('link', { name: 'Products' }),
      ).toHaveAttribute('aria-current', 'page')
    })

    it('closes on a second click, on Escape and on a click elsewhere', async () => {
      const user = await collapse()
      const icon = screen.getByRole('button', GROUP)

      await user.click(icon)
      await user.click(icon)
      expect(screen.queryByRole('group', GROUP)).not.toBeInTheDocument()

      await user.click(icon)
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('group', GROUP)).not.toBeInTheDocument()
      expect(icon).toHaveFocus()

      await user.click(icon)
      await user.click(document.body)
      expect(screen.queryByRole('group', GROUP)).not.toBeInTheDocument()
    })

    it('closes when a page is chosen', async () => {
      const user = await collapse()
      await user.click(screen.getByRole('button', GROUP))
      await user.click(screen.getByRole('link', { name: 'Customers' }))

      expect(screen.queryByRole('group', GROUP)).not.toBeInTheDocument()
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
