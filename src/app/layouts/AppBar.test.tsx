import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../lib/api/ApiError.ts'
import { api, type Shop } from '../../lib/api/endpoints.ts'
import { renderWithProviders } from '../../test/renderWithProviders.tsx'
import { shopSelected } from '../store/shopSlice.ts'
import { AppBar } from './AppBar.tsx'

vi.mock('../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api/endpoints.ts')>()),
  api: {
    shops: { list: vi.fn() },
    sync: { triggerProducts: vi.fn(), status: vi.fn() },
    auth: { logout: vi.fn() },
  },
}))

function makeShop(overrides: Partial<Shop>): Shop {
  return {
    id: 'id',
    key: null,
    name: null,
    domain: 'x.myshopify.com',
    is_active: true,
    position: 0,
    connected: true,
    products_count: 0,
    ...overrides,
  }
}

const SHOPS = [
  makeShop({
    id: 's1',
    key: 'polymer-uk',
    name: 'Polymer UK',
    domain: 'polymer-uk-ltd.myshopify.com',
  }),
  makeShop({
    id: 's2',
    key: 'polymer-eu',
    name: 'Polymer EU',
    domain: 'polymer-eu.myshopify.com',
  }),
  // No name and no key: falls back to the domain.
  makeShop({ id: 's3', domain: 'unnamed.myshopify.com' }),
]

const list = vi.mocked(api.shops.list)
const dropdown = () => screen.findByRole('combobox', { name: 'Shop' })

describe('AppBar shop dropdown', () => {
  beforeEach(() => {
    list.mockResolvedValue(SHOPS)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('lists "All shops" first, then every shop by name, with All selected by default', async () => {
    renderWithProviders(<AppBar />, { route: '/products' })

    const select = await dropdown()
    expect(select).toHaveValue('all')
    expect(Array.from((select as HTMLSelectElement).options).map((o) => o.text)).toEqual([
      'All shops',
      'Polymer UK',
      'Polymer EU',
      'unnamed.myshopify.com',
    ])
    expect(screen.getByText('Products')).toBeInTheDocument()
  })

  it('has the Sync products button on the Products page only', async () => {
    const { unmount } = renderWithProviders(<AppBar />, { route: '/products' })
    expect(
      await screen.findByRole('button', { name: 'Sync products' }),
    ).toBeInTheDocument()
    unmount()

    renderWithProviders(<AppBar />, { route: '/customers' })
    await dropdown()
    expect(
      screen.queryByRole('button', { name: 'Sync products' }),
    ).not.toBeInTheDocument()
  })

  it('also appears on the Customers page', async () => {
    renderWithProviders(<AppBar />, { route: '/customers' })
    expect(await dropdown()).toBeInTheDocument()
  })

  it('is hidden on pages that cannot be scoped to a store', async () => {
    renderWithProviders(<AppBar />, { route: '/' })

    expect(screen.queryByRole('combobox', { name: 'Shop' })).not.toBeInTheDocument()
    // …and the store list isn't requested for a page that doesn't show the dropdown.
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(list).not.toHaveBeenCalled()
  })

  it('scopes products and customers to the chosen store, and back to all', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<AppBar />, { route: '/products' })

    await user.selectOptions(await dropdown(), 'Polymer UK')
    expect(store.getState().shop.selected).toBe('polymer-uk')
    expect(store.getState().products.filters.shop).toBe('polymer-uk')
    expect(store.getState().customers.filters.shop).toBe('polymer-uk')

    await user.selectOptions(await dropdown(), 'All shops')
    expect(store.getState().shop.selected).toBe('all')
    expect(store.getState().products.filters.shop).toBe('')
    expect(store.getState().customers.filters.shop).toBe('')
  })

  it('goes back to page 1 when the store changes', async () => {
    const { store } = renderWithProviders(<AppBar />, { route: '/products' })
    await dropdown()

    store.dispatch({ type: 'products/filtersChanged', payload: { page: 3 } })
    expect(store.getState().products.filters.page).toBe(3)
    store.dispatch(shopSelected('polymer-eu'))

    expect(store.getState().products.filters).toMatchObject({
      shop: 'polymer-eu',
      page: 1,
    })
  })

  it('falls back to "all" if the selected store is no longer available', async () => {
    const { store } = renderWithProviders(<AppBar />, { route: '/products' })
    store.dispatch(shopSelected('removed-shop'))

    await dropdown()

    await waitFor(() => expect(store.getState().shop.selected).toBe('all'))
    expect(store.getState().products.filters.shop).toBe('')
  })

  it('stays out of the way when the shop list cannot be loaded', async () => {
    list.mockRejectedValue(new ApiError('Server error', { status: 500 }))
    const { store } = renderWithProviders(<AppBar />, { route: '/products' })

    await waitFor(() => expect(store.getState().shop.status).toBe('error'))
    expect(screen.queryByRole('combobox', { name: 'Shop' })).not.toBeInTheDocument()
    expect(store.getState().products.filters.shop).toBe('')
  })
})
