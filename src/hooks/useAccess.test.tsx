import { act, screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { DashboardLayout } from '../app/layouts/DashboardLayout.tsx'
import { NAV_ENTRIES, isNavGroup } from '../app/router/navigation.ts'
import { googleSignIn } from '../app/store/authSlice.ts'
import { CustomersPage } from '../features/customers/index.ts'
import { api, type AuthUser } from '../lib/api/endpoints.ts'
import { renderWithProviders } from '../test/renderWithProviders.tsx'
import { visibleNavEntries } from './useAccess.ts'

vi.mock('../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api/endpoints.ts')>()),
  api: {
    shops: { list: vi.fn().mockResolvedValue([]) },
    customers: {
      list: vi.fn().mockResolvedValue({
        items: [],
        totals: null,
        page: 1,
        page_size: 25,
        total: 0,
        total_pages: 1,
        has_next: false,
        sort: 'created_at',
        order: 'desc',
      }),
    },
    auth: { logout: vi.fn() },
  },
}))

const USER: AuthUser = {
  id: 'u1',
  email: 'a@b.co',
  full_name: 'A',
  phone: null,
  role: 'admin',
  is_active: true,
  last_login_at: null,
}

function renderAt(route: string, permissions?: AuthUser['permissions']) {
  const view = renderWithProviders(
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="orders" element={<p>the orders page</p>} />
        <Route path="users" element={<p>the users page</p>} />
      </Route>
    </Routes>,
    { route },
  )
  act(() => {
    view.store.dispatch(
      googleSignIn.fulfilled(
        {
          accessToken: 'session-token',
          expiresAt: new Date(Date.now() + 60_000 * 60).toISOString(),
          user: { ...USER, permissions },
        },
        'request-id',
        'credential',
      ),
    )
  })
  return view
}

const labels = (permissions: AuthUser['permissions']) =>
  visibleNavEntries(permissions).flatMap((entry) =>
    isNavGroup(entry) ? entry.items.map((item) => item.label) : [entry.label],
  )

describe('visibleNavEntries', () => {
  it('shows everything when the answer has no permissions, or doesn’t name an area', () => {
    expect(visibleNavEntries(undefined)).toEqual(NAV_ENTRIES)
    expect(visibleNavEntries({ something_else: { view: false } })).toEqual(NAV_ENTRIES)
    expect(visibleNavEntries({ users: { manage: false } })).toEqual(NAV_ENTRIES)
  })

  it('leaves out only a page whose area says view: false', () => {
    const shown = labels({ users: { view: false }, orders: { view: false } })
    expect(shown).not.toContain('User Management')
    expect(shown).not.toContain('Orders')
    expect(shown).toContain('Products')
    expect(shown).toContain('Dashboard')
  })

  it('leaves out a group with no page left', () => {
    const shown = visibleNavEntries({
      orders: { view: false },
      products: { view: false },
      customers: { view: false },
      inventory: { view: false },
      locks: { view: false },
    })
    expect(shown.some(isNavGroup)).toBe(false)
  })

  it('shows the office role only the Shopify Management group', () => {
    const shown = visibleNavEntries(undefined, NAV_ENTRIES, 'Office')
    expect(shown).toHaveLength(1)
    const group = shown[0]
    expect(isNavGroup(group)).toBe(true)
    if (!isNavGroup(group)) return
    expect(group.items.map((item) => item.label)).toEqual([
      'Orders',
      'Products',
      'Customers',
      'Inventory',
      'Lock Management',
    ])
  })
})

describe('exporting customers', () => {
  function renderCustomers(permissions?: AuthUser['permissions']) {
    const view = renderWithProviders(
      <Routes>
        <Route path="/customers/*" element={<CustomersPage />} />
      </Routes>,
      { route: '/customers' },
    )
    act(() => {
      view.store.dispatch(
        googleSignIn.fulfilled(
          {
            accessToken: 'session-token',
            expiresAt: new Date(Date.now() + 60_000 * 60).toISOString(),
            user: { ...USER, permissions },
          },
          'request-id',
          'credential',
        ),
      )
    })
  }

  it('is for those who may manage customers', async () => {
    renderCustomers({ customers: { view: true, manage: true } })
    expect(await screen.findByRole('button', { name: /^Export/ })).toBeInTheDocument()
  })

  it('is hidden from those who may only view them', async () => {
    renderCustomers({ customers: { view: true, manage: false } })
    await screen.findByRole('region', { name: 'Customers' })
    expect(screen.queryByRole('button', { name: /^Export/ })).not.toBeInTheDocument()
  })
})

describe('a page the user may not view', () => {
  it('shows "no access" for its address, without mounting the page', () => {
    renderAt('/users', { users: { view: false } })

    expect(screen.getByRole('heading', { name: /don.t have access/ })).toBeInTheDocument()
    expect(screen.queryByText('the users page')).not.toBeInTheDocument()
    expect(
      within(screen.getByRole('navigation')).queryByRole('link', {
        name: /User Management/,
      }),
    ).not.toBeInTheDocument()
  })

  it('leaves the pages the user may view alone', () => {
    renderAt('/orders', { users: { view: false }, orders: { view: true } })
    expect(screen.getByText('the orders page')).toBeInTheDocument()
  })

  it('hides the Sync button from a user who may only view', async () => {
    renderAt('/orders', { orders: { view: true, manage: false } })
    expect(screen.queryByRole('button', { name: /Sync orders/ })).not.toBeInTheDocument()
    expect(api.shops.list).toHaveBeenCalled()
  })
})
