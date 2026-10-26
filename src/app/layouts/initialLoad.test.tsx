import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActivityPage } from '../../features/activity/index.ts'
import { CustomersPage } from '../../features/customers/index.ts'
import { OrdersPage } from '../../features/orders/index.ts'
import { ProductsPage } from '../../features/products/index.ts'
import { UsersPage } from '../../features/users/index.ts'
import { renderWithProviders } from '../../test/renderWithProviders.tsx'
import { DashboardLayout } from './DashboardLayout.tsx'

/**
 * What a page asks the backend for when it opens, and when a filter is applied: only what it
 * shows. These render the whole signed-in shell (sidebar, top bar, page) against a fake
 * backend that records every request, so a request added to a page's start-up shows up here.
 */

const log = vi.hoisted(() => ({ calls: [] as { name: string; params: unknown }[] }))

vi.mock('../../lib/api/endpoints.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api/endpoints.ts')>()
  const record =
    <T,>(name: string, answer: (params: never) => T) =>
    (params?: unknown) => {
      log.calls.push({ name, params })
      return Promise.resolve(answer(params as never))
    }
  const page = (params: { page?: number; page_size?: number } | undefined) => {
    const size = params?.page_size ?? 25
    return {
      items: [] as never[],
      page: params?.page ?? 1,
      page_size: size,
      total: 60,
      total_pages: 3,
      has_next: true,
      sort: 'created_at',
      order: 'desc',
    }
  }
  return {
    ...actual,
    api: {
      shops: { list: record('shops.list', () => []) },
      products: { list: record('products.list', page) },
      customers: { list: record('customers.list', page) },
      orders: { list: record('orders.list', (p) => ({ ...page(p), totals: null })) },
      activity: {
        list: record('activity.list', page),
        actions: record('activity.actions', () => []),
      },
      users: { list: record('users.list', page) },
      roles: { list: record('roles.list', () => []) },
      sync: { triggerProducts: vi.fn(), status: record('sync.status', () => []) },
      auth: { logout: vi.fn() },
    },
  }
})

function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route index element={<p>the dashboard</p>} />
        <Route path="products/*" element={<ProductsPage />} />
        <Route path="customers/*" element={<CustomersPage />} />
        <Route path="orders/*" element={<OrdersPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="users/*" element={<UsersPage />} />
      </Route>
    </Routes>,
    { route },
  )
}

/** Let every request a page starts on open go out. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 60))

const names = () => log.calls.map((call) => call.name)
const callsTo = (name: string) => log.calls.filter((call) => call.name === name)
const isOneRow = (params: unknown) => (params as { page_size?: number }).page_size === 1

describe('what a page requests when it opens', () => {
  beforeEach(() => {
    log.calls = []
  })

  it('the dashboard asks for nothing at all', async () => {
    renderAt('/')
    await screen.findByText('the dashboard')
    await settle()

    expect(names()).toEqual([])
  })

  it('Products: its own list (page 1) and the store list — no other page, no counts', async () => {
    renderAt('/products')
    await waitFor(() => expect(callsTo('products.list')).toHaveLength(1))
    await settle()

    expect(callsTo('products.list')[0].params).toMatchObject({ page: 1, page_size: 25 })
    expect(callsTo('shops.list')).toHaveLength(1)
    expect([...new Set(names())].sort()).toEqual(['products.list', 'shops.list'])
  })

  it('Orders: its own list (page 1) and the store list — no other page, no counts', async () => {
    renderAt('/orders')
    await waitFor(() => expect(callsTo('orders.list')).toHaveLength(1))
    await settle()

    expect(callsTo('orders.list')[0].params).toMatchObject({ page: 1, page_size: 25 })
    expect([...new Set(names())].sort()).toEqual(['orders.list', 'shops.list'])
  })

  it('Customers: its own list asked for once, and the store list — the cards add no request', async () => {
    renderAt('/customers')
    await waitFor(() => expect(callsTo('customers.list')).toHaveLength(1))
    await settle()

    expect(callsTo('customers.list')[0].params).toMatchObject({ page: 1, page_size: 25 })
    expect([...new Set(names())].sort()).toEqual(['customers.list', 'shops.list'])
  })

  it('Users: its list (page 1), the roles and the store names — no status counts', async () => {
    renderAt('/users')
    await waitFor(() => expect(callsTo('users.list')).toHaveLength(1))
    await settle()

    expect(callsTo('users.list')[0].params).toMatchObject({ page: 1, page_size: 25 })
    expect([...new Set(names())].sort()).toEqual([
      'roles.list',
      'shops.list',
      'users.list',
    ])
  })

  it('Users: opening Filters loads the two status counts, and nothing else', async () => {
    const user = userEvent.setup()
    renderAt('/users')
    await waitFor(() => expect(callsTo('users.list')).toHaveLength(1))
    await settle()
    log.calls = []

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await waitFor(() => expect(callsTo('users.list').length).toBeGreaterThan(0))
    expect(callsTo('users.list').every((call) => isOneRow(call.params))).toBe(true)
    expect(names().every((name) => name === 'users.list')).toBe(true)
  })

  it('Activity: its list only — the action choices wait until Filters is opened, and users are never asked for', async () => {
    const user = userEvent.setup()
    renderAt('/activity')
    await waitFor(() => expect(callsTo('activity.list')).toHaveLength(1))
    await settle()

    expect(names()).toEqual(['activity.list'])

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await waitFor(() => expect(callsTo('activity.actions')).toHaveLength(1))
    await settle()
    expect(callsTo('users.list')).toHaveLength(0)
  })
})

describe('clicking a page in the sidebar', () => {
  beforeEach(() => {
    log.calls = []
  })

  it('asks nothing while the links are only hovered, and customers once when Customers is clicked', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await screen.findByText('the dashboard')
    await user.click(screen.getByRole('button', { name: 'Shopify Management' }))

    // Moving over the links asks for nothing…
    await user.hover(screen.getByRole('link', { name: 'Orders' }))
    await user.hover(screen.getByRole('link', { name: 'Products' }))
    await user.hover(screen.getByRole('link', { name: 'Customers' }))
    await settle()
    expect(names()).toEqual([])

    // …the click loads that page, and only that page, asking for customers once.
    await user.click(screen.getByRole('link', { name: 'Customers' }))
    await waitFor(() => expect(callsTo('customers.list')).toHaveLength(1))
    await settle()
    expect(callsTo('customers.list')).toHaveLength(1)
    expect(callsTo('customers.list')[0].params).toMatchObject({ page: 1, page_size: 25 })
    expect([...new Set(names())].sort()).toEqual(['customers.list', 'shops.list'])
  })
})

describe('what a page requests when a filter is used', () => {
  beforeEach(() => {
    log.calls = []
  })

  it('Products: opening Filters loads the status counts; choosing one asks for just that list', async () => {
    const user = userEvent.setup()
    renderAt('/products')
    await waitFor(() => expect(callsTo('products.list')).toHaveLength(1))
    await settle()
    expect(callsTo('products.list').some((call) => isOneRow(call.params))).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await waitFor(() =>
      expect(
        callsTo('products.list').filter((call) => isOneRow(call.params)),
      ).toHaveLength(4),
    )

    log.calls = []
    await user.selectOptions(screen.getByLabelText('Product status'), 'ACTIVE')
    await waitFor(() =>
      expect(
        callsTo('products.list').filter(
          (call) => !isOneRow(call.params) && (call.params as { status?: string }).status,
        ),
      ).toHaveLength(1),
    )
    // Only the products list is asked: no other page's data.
    expect(names().every((name) => name === 'products.list')).toBe(true)
  })

  it('Customers: without a filter nothing filter-specific is asked; a filter asks only for its list', async () => {
    const user = userEvent.setup()
    renderAt('/customers')
    await waitFor(() => expect(callsTo('customers.list')).toHaveLength(1))
    await settle()
    log.calls = []

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    // Opening the grid loads the role counts (they are shown in its first dropdown).
    await waitFor(() => expect(callsTo('customers.list').length).toBeGreaterThan(0))
    expect(callsTo('customers.list').every((call) => isOneRow(call.params))).toBe(true)

    log.calls = []
    await user.selectOptions(screen.getByLabelText('Account State'), 'ENABLED')
    await waitFor(() =>
      expect(
        callsTo('customers.list').some(
          (call) =>
            !isOneRow(call.params) &&
            (call.params as { state?: string }).state === 'ENABLED',
        ),
      ).toBe(true),
    )
    expect(names().every((name) => name === 'customers.list')).toBe(true)
  })
})
