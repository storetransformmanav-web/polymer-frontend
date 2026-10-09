import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  api,
  type ProductDetail,
  type ProductListItem,
  type ProductListParams,
  type ProductListResponse,
} from '../../../lib/api/endpoints.ts'
import { ApiError } from '../../../lib/api/ApiError.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { ProductsPage } from './ProductsPage.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: { products: { list: vi.fn(), details: vi.fn() }, auth: {} },
}))

const TOTAL = 60

function makeProduct(n: number): ProductListItem {
  return {
    id: `id-${n}`,
    shopify_id: n,
    title: `Product ${n}`,
    handle: `handle-${n}`,
    status: n % 2 === 0 ? 'ACTIVE' : 'DRAFT',
    vendor: `Vendor ${(n % 3) + 1}`,
    product_type: 'Desk',
    category_name: 'Furniture',
    tags: ['modern', `tag-${n}`],
    image_url: null,
    price_min: '170.00',
    price_max: n % 2 === 0 ? '170.00' : '200.00',
    currency: 'GBP',
    variants_count: 2,
    total_inventory: n === 3 ? 0 : 10,
    shopify_created_at: '2026-01-02T10:00:00Z',
    shopify_updated_at: '2026-02-03T10:00:00Z',
    synced_at: '2026-03-04T10:00:00Z',
  }
}

/** A fake server: 60 products, paged by the request's page/page_size. */
function respond(params: ProductListParams): ProductListResponse {
  const page = params.page ?? 1
  const pageSize = params.page_size ?? 20
  const matches = params.search === 'nomatch' ? 0 : TOTAL
  const start = (page - 1) * pageSize
  const count = Math.max(0, Math.min(pageSize, matches - start))

  return {
    items: Array.from({ length: count }, (_, i) => makeProduct(start + i + 1)),
    page,
    page_size: pageSize,
    total: matches,
    total_pages: Math.max(1, Math.ceil(matches / pageSize)),
    has_next: start + count < matches,
    sort: params.sort ?? 'created_at',
    order: params.order ?? 'desc',
  }
}

/** Details for product `id-N`, shaped like the real API's response. */
function makeDetail(id: string, raw = false): ProductDetail {
  const n = Number(id.replace('id-', ''))
  return {
    id,
    shopify_id: n,
    title: `Product ${n}`,
    handle: `handle-${n}`,
    description_html:
      '<p>Sturdy <strong>walnut</strong> desk</p><script>alert(1)</script>',
    status: 'ACTIVE',
    vendor: `Vendor ${(n % 3) + 1}`,
    product_type: 'Desk',
    category: { id: 'c1', name: 'Uncategorized', full_path: 'Home > Desks' },
    tags: ['modern'],
    template_suffix: '',
    has_only_default_variant: true,
    has_out_of_stock_variants: true,
    total_inventory: 0,
    tracks_inventory: true,
    requires_selling_plan: false,
    gift_card: false,
    seo: { title: 'Desk SEO title', description: null },
    online_store_url: null,
    online_store_preview_url: 'https://example.com/preview',
    currency: 'GBP',
    price_range: { min: '25.85', max: '25.85', currency: 'GBP' },
    compare_at_price_range: null,
    featured_image_url: null,
    variants_count: 1,
    media_count: 0,
    published_at: null,
    shopify_created_at: '2026-08-13T14:26:57Z',
    shopify_updated_at: '2026-10-06T19:56:29Z',
    synced_at: '2026-10-08T13:57:25Z',
    options: [{ name: 'Title', position: 1, values: ['Default Title'] }],
    images: [],
    variants: [
      {
        id: `v-${n}`,
        shopify_id: 1,
        title: 'Default Title',
        sku: `SKU-${n}`,
        barcode: '1000',
        price: '25.85',
        currency: 'GBP',
        inventory_quantity: 0,
        available_for_sale: false,
        inventory_levels: [
          {
            location_shopify_id: 60465184951,
            location_name: 'Park Royal warehouse',
            available: 0,
            on_hand: 3,
            committed: 0,
            incoming: 0,
          },
        ],
        metafields: [],
      },
    ],
    collections: [
      {
        id: 'col1',
        shopify_id: 1,
        title: 'Best Selling Products',
        handle: 'best-selling-products',
        collection_type: 'smart',
      },
    ],
    metafields: [],
    raw_json: raw ? { id: `gid://shopify/Product/${n}`, vendor: 'RAW-VENDOR' } : null,
  }
}

const list = vi.mocked(api.products.list)
const details = vi.mocked(api.products.details)
const callsForPage = (page: number) =>
  list.mock.calls.filter(([params]) => params.page === page).length

function Path() {
  return <p data-testid="path">{useLocation().pathname}</p>
}

function renderPage(route = '/products') {
  return renderWithProviders(
    <>
      <Path />
      <Routes>
        <Route path="/products/*" element={<ProductsPage />} />
      </Routes>
    </>,
    { route },
  )
}

describe('ProductsPage list', () => {
  beforeEach(() => {
    list.mockImplementation((params) => Promise.resolve(respond(params)))
    details.mockImplementation((id, raw) => Promise.resolve(makeDetail(id, raw)))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads the first page from the API with the default query', async () => {
    renderPage()

    expect(await screen.findByText('Product 1')).toBeInTheDocument()
    expect(list).toHaveBeenCalledWith({
      sort: 'created_at',
      order: 'desc',
      page: 1,
      page_size: 25,
    })
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 1 to 25 of 60 entries')
    // Price range for a multi-variant product, single price otherwise.
    expect(screen.getAllByText('£170.00 – £200.00').length).toBeGreaterThan(0)
    expect(
      within(screen.getByRole('table')).getByText('Out of stock'),
    ).toBeInTheDocument()
  })

  it('searches after a short pause and returns to page 1', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')

    await user.type(screen.getByRole('searchbox', { name: 'Search products' }), 'nomatch')

    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'nomatch', page: 1 }),
      ),
    )
    expect(await screen.findByText('No products found')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear all filters' }))
    expect(await screen.findByText('Product 1')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search products' })).toHaveValue('')
  })

  it('filters by status tab and sends it to the API', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')

    await user.click(screen.getByRole('button', { name: 'Unlisted' }))

    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(expect.objectContaining({ status: 'UNLISTED' })),
    )
    expect(screen.getByRole('button', { name: /^Unlisted/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('sends sort, order and stock filters', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')

    await user.selectOptions(screen.getByLabelText('Sort by'), 'price')
    await user.selectOptions(screen.getByLabelText('Order'), 'asc')
    await user.selectOptions(screen.getByLabelText('Stock'), 'in')

    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'price', order: 'asc', in_stock: true, page: 1 }),
      ),
    )
  })

  it('shows the next page instantly (prefetched) and re-visits pages from cache', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')

    // Page 2 is requested in the background without being asked for.
    await waitFor(() => expect(callsForPage(2)).toBe(1))
    const callsBefore = list.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Page 2' }))
    // No await/findBy: the rows are there in the same render as the click.
    expect(screen.getByText('Product 26')).toBeInTheDocument()
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 26 to 50 of 60')

    await user.click(screen.getByRole('button', { name: 'Page 1' }))
    expect(screen.getByText('Product 1')).toBeInTheDocument()

    // Page 1 was never fetched a second time; only page 3 was prefetched.
    expect(callsForPage(1)).toBe(1)
    expect(list.mock.calls.length - callsBefore).toBeLessThanOrEqual(1)
  })

  it('changes the page size', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')

    await user.selectOptions(screen.getByLabelText('Entries per page'), '10')

    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ page_size: 10, page: 1 }),
      ),
    )
    expect(await screen.findByText(/Showing/)).toHaveTextContent('Showing 1 to 10 of 60')
  })

  it('shows the backend error and recovers on retry', async () => {
    list.mockRejectedValueOnce(new ApiError('Not logged in.', { status: 401 }))
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText("Couldn't load products")).toBeInTheDocument()
    expect(screen.getByText('Not logged in.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Product 1')).toBeInTheDocument()
  })
})

describe('ProductsPage details', () => {
  beforeEach(() => {
    list.mockImplementation((params) => Promise.resolve(respond(params)))
    details.mockImplementation((id, raw) => Promise.resolve(makeDetail(id, raw)))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('opens a product on the same page — as a tab, not a slide-over — from the View button', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')

    await user.click(screen.getByRole('button', { name: 'View Product 3' }))

    expect(screen.getByTestId('path')).toHaveTextContent('/products/id-3')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Product 3' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const tabs = screen.getByRole('navigation', { name: 'Open products' })
    expect(
      within(tabs).getByRole('button', { name: /^Product\s*handle-3$/ }),
    ).toHaveAttribute('aria-current', 'page')
  })

  it('does not open details when a row is clicked anywhere but the View button', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 3')

    await user.click(screen.getByText('Product 3'))

    expect(screen.getByTestId('path')).toHaveTextContent(/^\/products$/)
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it('shows the header at once from the list row while details are still loading', async () => {
    details.mockReturnValue(new Promise(() => undefined)) // never answers
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')

    await user.click(screen.getByRole('button', { name: 'View Product 4' }))

    // Title, status and vendor come from the already-loaded list row.
    expect(
      screen.getByRole('heading', { level: 1, name: 'Product 4' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Vendor 2').length).toBeGreaterThan(0)
    expect(screen.getAllByText('£170.00').length).toBeGreaterThan(0)
  })

  it('prefetches details on hover so opening needs no extra request', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')

    await user.hover(screen.getByRole('button', { name: 'View Product 2' }))
    await waitFor(() => expect(details).toHaveBeenCalledWith('id-2', false))
    const callsAfterHover = details.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'View Product 2' }))

    // Full details are on screen immediately (cached), with no second request.
    expect(screen.getByText('Home > Desks')).toBeInTheDocument()
    expect(details.mock.calls.length).toBe(callsAfterHover)
  })

  it('renders the overview, variants, inventory and collections from the API data', async () => {
    const user = userEvent.setup()
    renderPage('/products/id-7')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Product 7' }),
    ).toBeInTheDocument()
    expect(details).toHaveBeenCalledWith('id-7', false) // raw payload not requested up front

    // Overview: specs, price, description stripped to plain text (no markup/script).
    expect(await screen.findByText('Home > Desks')).toBeInTheDocument()
    expect(screen.getByText('£25.85')).toBeInTheDocument()
    const description = screen.getByText('Sturdy walnut desk')
    expect(description.querySelector('strong, script')).toBeNull()
    expect(description).not.toHaveTextContent('alert')
    expect(screen.getByText('SKU-7')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Variants/ }))
    expect(screen.getByRole('cell', { name: /Default Title/ })).toBeInTheDocument()
    expect(screen.getByText('Unavailable')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Inventory/ }))
    expect(screen.getByText('Park Royal warehouse')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Collections/ }))
    expect(screen.getByText('best-selling-products')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Media/ }))
    expect(screen.getByText('This product has no images.')).toBeInTheDocument()
  })

  it('loads the raw Shopify data only when its tab is opened', async () => {
    const user = userEvent.setup()
    renderPage('/products/id-7')
    await screen.findByText('Home > Desks')
    expect(details).not.toHaveBeenCalledWith('id-7', true)

    await user.click(screen.getByRole('tab', { name: 'Raw data' }))

    expect(await screen.findByText(/RAW-VENDOR/)).toBeInTheDocument()
    expect(details).toHaveBeenCalledWith('id-7', true)
  })

  it('labels a tab opened from a bare URL once the product loads', async () => {
    renderPage('/products/id-9')

    const tabs = await screen.findByRole('navigation', { name: 'Open products' })
    await waitFor(() =>
      expect(
        within(tabs).getByRole('button', { name: /^Product\s*handle-9$/ }),
      ).toBeInTheDocument(),
    )
  })

  it('shows the backend message when a product cannot be loaded, and goes back', async () => {
    details.mockRejectedValue(new ApiError('Product not found.', { status: 404 }))
    const user = userEvent.setup()
    renderPage('/products/id-404')

    expect(await screen.findByText("Couldn't load this product")).toBeInTheDocument()
    expect(screen.getByText('Product not found.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to list' }))
    expect(screen.getByTestId('path')).toHaveTextContent(/^\/products$/)
  })

  it('goes back to the list, keeps the tab, and reopens it from cache without a request', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')

    await user.click(screen.getByRole('button', { name: 'View Product 5' }))
    await screen.findByText('Home > Desks')
    await user.click(screen.getByRole('button', { name: 'Back to list' }))

    expect(screen.getByTestId('path')).toHaveTextContent(/^\/products$/)
    const tabs = screen.getByRole('navigation', { name: 'Open products' })
    expect(within(tabs).getByRole('button', { name: /All Products/ })).toHaveAttribute(
      'aria-current',
      'page',
    )

    const calls = details.mock.calls.length
    await user.click(within(tabs).getByRole('button', { name: /^Product\s*handle-5$/ }))
    expect(screen.getByText('Home > Desks')).toBeInTheDocument()
    expect(details.mock.calls.length).toBe(calls)
  })

  it('closes tabs: the active one moves to its neighbour, and Clear returns to the list', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')

    await user.click(screen.getByRole('button', { name: 'View Product 1' }))
    await screen.findByText('Home > Desks')
    const tabs = screen.getByRole('navigation', { name: 'Open products' })
    await user.click(within(tabs).getByRole('button', { name: /All Products/ }))
    await user.click(screen.getByRole('button', { name: 'View Product 2' }))
    await screen.findByRole('heading', { level: 1, name: 'Product 2' })

    await user.click(within(tabs).getByRole('button', { name: 'Close handle-2' }))
    expect(screen.getByTestId('path')).toHaveTextContent('/products/id-1')

    await user.click(within(tabs).getByRole('button', { name: 'Clear' }))
    expect(screen.getByTestId('path')).toHaveTextContent(/^\/products$/)
    expect(
      screen.queryByRole('navigation', { name: 'Open products' }),
    ).not.toBeInTheDocument()
  })
})

describe('ProductsPage quick view', () => {
  beforeEach(() => {
    list.mockImplementation((params) => Promise.resolve(respond(params)))
    details.mockImplementation((id, raw) => Promise.resolve(makeDetail(id, raw)))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('opens a right-side panel when a product image is clicked, without leaving the list', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')

    await user.click(screen.getByRole('button', { name: 'Quick view Product 3' }))

    // Appears at once: it only needs the row that's already loaded.
    const panel = screen.getByRole('dialog', { name: 'Product 3 quick view' })
    expect(within(panel).getByText('Vendor 1')).toBeInTheDocument()
    expect(within(panel).getByText('Out of stock')).toBeInTheDocument()
    expect(within(panel).getByText('tag-3')).toBeInTheDocument()
    expect(screen.getByTestId('path')).toHaveTextContent(/^\/products$/)
    expect(
      screen.queryByRole('navigation', { name: 'Open products' }),
    ).not.toBeInTheDocument()
  })

  it('closes with Escape, the close button, or the backdrop, and returns focus to the image', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')
    const image = screen.getByRole('button', { name: 'Quick view Product 2' })

    await user.click(image)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(image).toHaveFocus()

    await user.click(image)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(image)
    await user.click(screen.getByRole('button', { name: 'Close quick view' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('continues to the full details page from the panel', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')

    await user.click(screen.getByRole('button', { name: 'Quick view Product 4' }))
    await user.click(screen.getByRole('button', { name: /Open full details/ }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('path')).toHaveTextContent('/products/id-4')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Product 4' }),
    ).toBeInTheDocument()
  })

  it('prefetches details when the image is hovered, so "Open full details" is instant', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')

    await user.hover(screen.getByRole('button', { name: 'Quick view Product 6' }))
    await waitFor(() => expect(details).toHaveBeenCalledWith('id-6', false))
  })
})
