import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../lib/api/endpoints.ts'
import { renderWithProviders } from '../../test/renderWithProviders.tsx'
import { NAV_ITEMS } from '../router/navigation.ts'
import { DashboardLayout } from './DashboardLayout.tsx'

const emptyList = {
  items: [],
  page: 1,
  page_size: 25,
  total: 0,
  total_pages: 1,
  has_next: false,
  sort: 'created_at',
  order: 'desc',
}

vi.mock('../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api/endpoints.ts')>()),
  api: {
    shops: { list: vi.fn() },
    products: { list: vi.fn() },
    customers: { list: vi.fn() },
    orders: { list: vi.fn() },
    sync: { triggerProducts: vi.fn(), status: vi.fn() },
    auth: { logout: vi.fn() },
  },
}))

function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="orders" element={<p>the orders page</p>} />
        <Route path="products" element={<p>the products page</p>} />
        <Route path="customers" element={<p>the customers page</p>} />
      </Route>
    </Routes>,
    { route },
  )
}

describe('DashboardLayout', () => {
  beforeEach(() => {
    vi.mocked(api.shops.list).mockResolvedValue([])
    vi.mocked(api.products.list).mockResolvedValue(emptyList)
    vi.mocked(api.customers.list).mockResolvedValue(emptyList)
    vi.mocked(api.orders.list).mockResolvedValue({ ...emptyList, totals: null })
  })

  it('marks only the Orders page as one that fills the window’s height', () => {
    expect(NAV_ITEMS.filter((item) => item.fillHeight).map((item) => item.to)).toEqual([
      '/orders',
    ])
  })

  it('gives a page that fills the height the whole window from lg up: nothing scrolls but the page’s own list', () => {
    const { container } = renderAt('/orders')

    const layout = container.firstElementChild as HTMLElement
    expect(layout.className).toContain('lg:h-svh')
    expect(layout.className).toContain('lg:overflow-hidden')
    const main = screen.getByRole('main')
    expect(main.className).toContain('lg:flex-col')
    expect(main.className).toContain('lg:min-h-0')
    expect(main.className).toContain('lg:overflow-hidden')
    expect(screen.getByText('the orders page')).toBeInTheDocument()
  })

  it('leaves every other page scrolling as a whole, as before', () => {
    for (const route of ['/products', '/customers']) {
      const { container, unmount } = renderAt(route)

      const layout = container.firstElementChild as HTMLElement
      expect(layout.className).not.toContain('lg:h-svh')
      expect(layout.className).not.toContain('overflow-hidden')
      expect(screen.getByRole('main').className).not.toContain('lg:overflow-hidden')
      unmount()
    }
  })
})
