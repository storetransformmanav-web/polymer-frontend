import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  api,
  type AccessLock,
  type ProductListItem,
  type ProductListResponse,
} from '../../../lib/api/endpoints.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { ProductsPage } from './ProductsPage.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    products: { list: vi.fn(), details: vi.fn() },
    access: { tags: vi.fn(), locks: vi.fn() },
    shops: { list: vi.fn(() => Promise.resolve([])) },
    auth: {},
  },
}))

const SHOP = { key: 'polymer-uk', name: 'Polymer UK' }

function makeProduct(n: number): ProductListItem {
  return {
    id: `id-${n}`,
    shopify_id: n,
    title: `Product ${n}`,
    handle: `handle-${n}`,
    status: 'ACTIVE',
    vendor: 'Vendor',
    product_type: 'Desk',
    category_name: 'Furniture',
    tags: [],
    image_url: null,
    price_min: '10.00',
    price_max: '10.00',
    currency: 'GBP',
    variants_count: 1,
    total_inventory: 5,
    shopify_created_at: '2026-01-02T10:00:00Z',
    shopify_updated_at: '2026-02-03T10:00:00Z',
    synced_at: '2026-03-04T10:00:00Z',
    shop: SHOP,
  } as unknown as ProductListItem
}

const PRODUCTS_ANSWER = {
  items: [makeProduct(1), makeProduct(2), makeProduct(3)],
  page: 1,
  page_size: 25,
  total: 3,
  total_pages: 1,
  has_next: false,
} as unknown as ProductListResponse

// Only Product 2 is locked.
const LOCK = {
  product_id: 'id-2',
  shopify_id: 2,
  title: 'Product 2',
  handle: 'handle-2',
  status: 'ACTIVE',
  image_url: null,
  product_tags: ['b2b'],
  enabled: true,
  tags: ['b2b', 'vip'],
  hide_from_lists: true,
  hide_from_nav: false,
  noindex: true,
  hide_from_sitemap: false,
  manual_locking: false,
  message: 'Please sign in to see this product.',
  customers_with_access: 1234,
  sync_status: 'synced',
  sync_error: null,
  last_pushed_at: '2026-11-10T10:00:00Z',
  updated_at: '2026-11-11T09:30:00Z',
  shop: SHOP,
} as unknown as AccessLock

function Path() {
  const location = useLocation()
  return <p data-testid="path">{location.pathname}</p>
}

function renderPage() {
  return renderWithProviders(
    <>
      <Path />
      <Routes>
        <Route path="/products/*" element={<ProductsPage />} />
        <Route path="/locks/*" element={<p>Lock Management page</p>} />
      </Routes>
    </>,
    { route: '/products' },
  )
}

describe('the lock icon in the products list', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.mocked(api.products.list).mockResolvedValue(PRODUCTS_ANSWER)
    vi.mocked(api.access.locks).mockResolvedValue({
      locks: [LOCK],
      page: 1,
      page_size: 100,
      total: 1,
      total_pages: 1,
      has_next: false,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('is drawn only for a product that is locked, from the store’s locks', async () => {
    renderPage()
    await screen.findByText('Product 1')

    expect(
      await screen.findByRole('button', { name: 'View the lock of Product 2' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'View the lock of Product 1' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'View the lock of Product 3' }),
    ).not.toBeInTheDocument()
    // One read of the store's locks (not one per product).
    expect(api.access.locks).toHaveBeenCalledTimes(1)
    expect(api.access.locks).toHaveBeenCalledWith(
      expect.objectContaining({ shop: 'polymer-uk', page: 1, page_size: 100 }),
    )
  })

  it('opens the lock’s details page inside the products page, with no window', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(
      await screen.findByRole('button', { name: 'View the lock of Product 2' }),
    )

    // A page laid out like a product's: the shared header, the tab strip and the cards.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Product 2' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: 'Customer Access' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to list' })).toBeInTheDocument()
    // Nothing was navigated to, and the lock has a tab of its own beside the products'.
    expect(screen.getByTestId('path')).toHaveTextContent(/^\/products$/)
    expect(screen.queryByText('Lock Management page')).not.toBeInTheDocument()
    const strip = screen.getByRole('navigation', { name: 'Open products' })
    expect(
      within(strip).getByRole('button', { name: /^Lock\s*Product 2$/ }),
    ).toHaveAttribute('aria-current', 'page')

    expect(screen.getByText('Enabled')).toBeInTheDocument()
    expect(screen.getByText('Synced with Shopify')).toBeInTheDocument()
    const overview = screen.getByRole('tabpanel')
    expect(within(overview).getByText('b2b')).toBeInTheDocument()
    expect(within(overview).getByText('vip')).toBeInTheDocument()
    expect(screen.getByText('1,234')).toBeInTheDocument()
    expect(within(overview).getByText('Polymer UK')).toBeInTheDocument()
    expect(
      within(overview).getByText('Please sign in to see this product.'),
    ).toBeInTheDocument()
    // The settings, as Yes / No.
    expect(
      within(overview).getByText('Hidden from lists').closest('div'),
    ).toHaveTextContent('Yes')
    expect(
      within(overview).getByText('Hidden from navigation menus').closest('div'),
    ).toHaveTextContent('No')
    // It was drawn from the locks already read: no other request.
    expect(api.access.locks).toHaveBeenCalledTimes(1)
  })

  it('goes back to the list with "Back to list", still on the same page', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(
      await screen.findByRole('button', { name: 'View the lock of Product 2' }),
    )
    await screen.findByRole('heading', { level: 1, name: 'Product 2' })

    await user.click(screen.getByRole('button', { name: 'Back to list' }))
    await waitFor(() =>
      expect(screen.queryByRole('tablist', { name: 'Lock sections' })).toBeNull(),
    )
    expect(
      screen.getByRole('button', { name: 'View the lock of Product 2' }),
    ).toBeVisible()
    expect(screen.getByTestId('path')).toHaveTextContent(/^\/products$/)
    // The tab stays open, and a click on it brings the lock back.
    const strip = screen.getByRole('navigation', { name: 'Open products' })
    await user.click(within(strip).getByRole('button', { name: /^Lock\s*Product 2$/ }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Product 2' }),
    ).toBeInTheDocument()
  })

  it('closes the lock’s tab with its ✕, back on the list', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(
      await screen.findByRole('button', { name: 'View the lock of Product 2' }),
    )
    await screen.findByRole('heading', { level: 1, name: 'Product 2' })

    await user.click(screen.getByRole('button', { name: 'Close Product 2' }))
    await waitFor(() =>
      expect(screen.queryByRole('tablist', { name: 'Lock sections' })).toBeNull(),
    )
    expect(screen.queryByRole('navigation', { name: 'Open products' })).toBeNull()
  })

  it('goes to Lock Management only when "Open in Lock Management" is pressed', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(
      await screen.findByRole('button', { name: 'View the lock of Product 2' }),
    )
    await user.click(
      await screen.findByRole('button', { name: /Open in Lock Management/ }),
    )

    expect(await screen.findByText('Lock Management page')).toBeInTheDocument()
    expect(screen.getByTestId('path')).toHaveTextContent('/locks/handle-2')
  })

  it('keeps the list working when the locks cannot be read: no icons, no errors', async () => {
    vi.mocked(api.access.locks).mockRejectedValue(new Error('403'))
    renderPage()
    expect(await screen.findByText('Product 1')).toBeInTheDocument()
    expect(screen.getByText('Product 3')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /View the lock of/ })).toBeNull()
  })
})
