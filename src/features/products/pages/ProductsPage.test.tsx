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
import { shopSelected } from '../../../app/store/shopSlice.ts'
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
// One-row requests are the status tabs' counts, not pages of the list.
const isCountQuery = (params: ProductListParams) => params.page_size === 1
const callsForPage = (page: number) =>
  list.mock.calls.filter(([params]) => params.page === page && !isCountQuery(params))
    .length

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
    // Product 3 is out of stock: shown in the Inventory column.
    const table = screen.getByRole('table')
    expect(within(table).getByText('Out of stock')).toBeInTheDocument()
  })

  it('offers no vendor filter and no vendor sort option', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')
    await user.click(screen.getByRole('button', { name: 'Filters' }))

    expect(screen.queryByLabelText('Vendor')).not.toBeInTheDocument()
    expect(screen.queryByText('All Vendors')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Sort by')).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Vendor' })).not.toBeInTheDocument()
  })

  it('lays the table out as Image, Product, Variants, Status, Inventory, Price, Actions', async () => {
    renderPage()
    await screen.findByText('Product 1')

    const table = screen.getByRole('table')
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((header) => header.textContent)
    expect(headers).toEqual([
      'Image',
      'Product',
      'Variants',
      'Status',
      'Inventory',
      'Price',
      'Actions',
    ])
    expect(within(table).queryByText('Vendor 2')).not.toBeInTheDocument()

    // Product 1: 2 variants, 10 units. Product 3 is out of stock.
    const [, row1, , row3] = within(table).getAllByRole('row')
    const cells1 = within(row1).getAllByRole('cell')
    expect(cells1[2]).toHaveTextContent('2')
    // Alignment classes must not conflict (a stray text-left beat text-center).
    expect(cells1[2]).toHaveClass('text-center')
    expect(cells1[2]).not.toHaveClass('text-left')
    expect(cells1[4]).toHaveClass('text-right')
    expect(cells1[4]).not.toHaveClass('text-left')
    expect(cells1[4]).toHaveTextContent('10')
    expect(within(row3).getAllByRole('cell')[4]).toHaveTextContent('Out of stock')
  })

  it('starts with the filter grid collapsed and reveals it from the Filters button', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')

    const toggle = screen.getByRole('button', { name: 'Filters' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('product-filter-grid')).toHaveAttribute('inert')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('product-filter-grid')).not.toHaveAttribute('inert')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('queries the store picked in the top bar (list and status counts), and "Clear all" keeps it', async () => {
    const user = userEvent.setup()
    const { store } = renderPage()
    await screen.findByText('Product 1')
    // Every store by default: no `shop` parameter at all.
    expect(list.mock.calls.every(([params]) => !('shop' in params))).toBe(true)

    store.dispatch(shopSelected('polymer-uk'))

    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ shop: 'polymer-uk', page: 1, page_size: 25 }),
      ),
    )
    // The status tab counts follow the same store.
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ shop: 'polymer-uk', status: 'ACTIVE', page_size: 1 }),
      ),
    )

    await user.type(screen.getByRole('searchbox', { name: 'Search products' }), 'nomatch')
    await user.click(await screen.findByRole('button', { name: 'Clear all filters' }))
    expect(store.getState().products.filters.shop).toBe('polymer-uk')

    store.dispatch(shopSelected('all'))
    expect(store.getState().products.filters.shop).toBe('')
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

    await user.click(screen.getByRole('button', { name: /^Unlisted/ }))

    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(expect.objectContaining({ status: 'UNLISTED' })),
    )
    expect(screen.getByRole('button', { name: /^Unlisted/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('shows a count on every status tab, honouring the other filters', async () => {
    list.mockImplementation((params) => {
      const byStatus = { ACTIVE: 40, DRAFT: 15, ARCHIVED: 5, UNLISTED: 0 }
      const total = params.status ? byStatus[params.status] : 60
      return Promise.resolve({ ...respond(params), total })
    })
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')

    const tabs = screen.getByRole('group', { name: 'Filter by status' })
    expect(
      await within(tabs).findByRole('button', { name: /^All Products\s*60$/ }),
    ).toBeInTheDocument()
    expect(
      within(tabs).getByRole('button', { name: /^Active\s*40$/ }),
    ).toBeInTheDocument()
    expect(within(tabs).getByRole('button', { name: /^Draft\s*15$/ })).toBeInTheDocument()
    expect(
      within(tabs).getByRole('button', { name: /^Archived\s*5$/ }),
    ).toBeInTheDocument()
    expect(
      within(tabs).getByRole('button', { name: /^Unlisted\s*0$/ }),
    ).toBeInTheDocument()

    // The search narrows the counts too (the fake server ignores it, so only
    // check that the count queries carry it).
    await user.type(screen.getByRole('searchbox', { name: 'Search products' }), 'desk')
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'desk', status: 'DRAFT', page_size: 1 }),
      ),
    )
  })

  it('sends sort, order and stock filters', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')

    await user.click(screen.getByRole('button', { name: 'Filters' }))
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
    // Fail the list's first page once (not the tabs' one-row count queries).
    let failed = false
    list.mockImplementation((params) => {
      if (!failed && !isCountQuery(params)) {
        failed = true
        return Promise.reject(new ApiError('Not logged in.', { status: 401 }))
      }
      return Promise.resolve(respond(params))
    })
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

  it('lists the product tags as chips in a boxed "Tags" section', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')

    await user.click(screen.getByRole('button', { name: 'View Product 3' }))

    const tags = await screen.findByRole('region', { name: 'Tags' })
    expect(within(tags).getByRole('heading', { name: 'Tags' })).toBeInTheDocument()
    expect(within(tags).getByRole('listitem')).toHaveTextContent('modern')
  })

  it('opens details from the product name, prefetching them on hover', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 3')

    await user.hover(screen.getByRole('button', { name: 'Product 3' }))
    await waitFor(() => expect(details).toHaveBeenCalledWith('id-3', false))
    const callsAfterHover = details.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Product 3' }))

    expect(screen.getByTestId('path')).toHaveTextContent('/products/id-3')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Product 3' }),
    ).toBeInTheDocument()
    expect(details.mock.calls.length).toBe(callsAfterHover)
  })

  it('does not open details when a row is clicked anywhere but the name, View button or card', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 3')

    const row = screen.getByRole('button', { name: 'View Product 3' }).closest('tr')
    expect(row).not.toBeNull()
    // Price cell (second to last) — plain text, not a link.
    await user.click(within(row as HTMLElement).getAllByRole('cell')[5])

    expect(screen.getByTestId('path')).toHaveTextContent(/^\/products$/)
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it('shows the header at once from the list row while details are still loading', async () => {
    details.mockReturnValue(new Promise(() => undefined)) // never answers
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')

    await user.click(screen.getByRole('button', { name: 'View Product 4' }))

    // Name, stock and price come from the already-loaded list row.
    const header = screen.getByRole('banner')
    expect(
      within(header).getByRole('heading', { level: 1, name: 'Product 4' }),
    ).toBeInTheDocument()
    expect(within(header).getByText('10')).toBeInTheDocument()
    expect(within(header).getByText('in stock')).toBeInTheDocument()
    expect(within(header).getByText('£170.00')).toBeInTheDocument()
    // Status and vendor stay in the header too, from the same list row.
    expect(within(header).getByText('Vendor 2')).toBeInTheDocument()
    expect(within(header).getByText('Active')).toBeInTheDocument()
  })

  it('shows the name, total stock and price in the header, from the list row while loading', async () => {
    details.mockReturnValue(new Promise(() => undefined)) // never answers
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')

    await user.click(screen.getByRole('button', { name: 'View Product 3' }))

    const header = screen.getByRole('banner')
    expect(
      within(header).getByRole('heading', { level: 1, name: 'Product 3' }),
    ).toBeInTheDocument()
    expect(within(header).getByText('Total stock')).toBeInTheDocument()
    expect(within(header).getByText('Out of stock')).toBeInTheDocument()
    expect(within(header).getByText('Price')).toBeInTheDocument()
    expect(within(header).getByText('£170.00 – £200.00')).toBeInTheDocument()
  })

  it('keeps total stock and price in the header on every tab, not as Overview cards', async () => {
    const user = userEvent.setup()
    renderPage('/products/id-7')
    await screen.findByText('Home > Desks')

    // In the header — and the old Price / Total stock cards are gone from Overview.
    const overview = screen.getByRole('tabpanel')
    expect(within(overview).queryByText('Total stock')).not.toBeInTheDocument()
    expect(within(overview).queryByText('Price')).not.toBeInTheDocument()
    expect(within(overview).queryByText('£25.85')).not.toBeInTheDocument()
    expect(within(screen.getByRole('banner')).getByText('Price')).toBeInTheDocument()
    expect(within(screen.getByRole('banner')).getByText('£25.85')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Variants/ }))
    expect(
      within(screen.getByRole('banner')).getByText('Total stock'),
    ).toBeInTheDocument()
    expect(within(screen.getByRole('banner')).getByText('£25.85')).toBeInTheDocument()
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
    // The header no longer shows a SKU; it lives in the Variants tab.
    expect(screen.queryByText('SKU-7')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Variants/ }))
    expect(screen.getByText('SKU-7')).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: /Default Title/ })).toBeInTheDocument()
    expect(screen.getByText('Unavailable')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Inventory/ }))
    expect(screen.getByText('Park Royal warehouse')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Collections/ }))
    expect(screen.getByText('best-selling-products')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Media/ }))
    expect(screen.getByText('This product has no images.')).toBeInTheDocument()
  })

  it('starts with Status & Launch and Description collapsed, Specifications open', async () => {
    const user = userEvent.setup()
    renderPage('/products/id-7')
    await screen.findByText('Home > Desks')

    const section = (name: string) =>
      screen.getByRole('button', { name: new RegExp(`^${name}`) })
    expect(section('Product Specifications')).toHaveAttribute('aria-expanded', 'true')
    expect(section('Status & Launch')).toHaveAttribute('aria-expanded', 'false')
    expect(section('Description')).toHaveAttribute('aria-expanded', 'false')

    await user.click(section('Description'))
    expect(section('Description')).toHaveAttribute('aria-expanded', 'true')
  })

  describe('collections tab', () => {
    const COLLECTIONS = Array.from({ length: 10 }, (_, i) => ({
      id: `col-${i}`,
      shopify_id: 100 + i,
      title: i === 0 ? 'Food Packaging' : `Collection ${i}`,
      handle: i === 0 ? 'food-packaging' : `collection-${i}`,
      collection_type: i === 9 ? 'custom' : 'smart',
    }))

    beforeEach(() => {
      details.mockImplementation((id) =>
        Promise.resolve({ ...makeDetail(id), collections: COLLECTIONS }),
      )
    })

    it('summarises the collections and labels custom ones as Manual', async () => {
      const user = userEvent.setup()
      renderPage('/products/id-7')
      await screen.findByText('Home > Desks')

      await user.click(screen.getByRole('tab', { name: /Collections/ }))
      const panel = screen.getByRole('tabpanel')

      expect(within(panel).getByText('In 10 collections')).toBeInTheDocument()
      expect(within(panel).getByText('9 Smart')).toBeInTheDocument()
      expect(within(panel).getByText('1 Manual')).toBeInTheDocument()
      expect(within(panel).getAllByRole('listitem')).toHaveLength(10)
      expect(within(panel).getByText('food-packaging')).toBeInTheDocument()
      expect(
        within(panel).getByRole('button', { name: 'Copy handle food-packaging' }),
      ).toBeInTheDocument()
    })

    it('filters by title or handle, and says so when nothing matches', async () => {
      const user = userEvent.setup()
      renderPage('/products/id-7')
      await screen.findByText('Home > Desks')
      await user.click(screen.getByRole('tab', { name: /Collections/ }))
      const panel = screen.getByRole('tabpanel')

      await user.type(
        within(panel).getByRole('searchbox', { name: 'Filter collections' }),
        'food',
      )
      expect(within(panel).getAllByRole('listitem')).toHaveLength(1)
      expect(within(panel).getByText('Food Packaging')).toBeInTheDocument()

      await user.clear(
        within(panel).getByRole('searchbox', { name: 'Filter collections' }),
      )
      await user.type(
        within(panel).getByRole('searchbox', { name: 'Filter collections' }),
        'zzz',
      )
      expect(within(panel).getByText(/No collections match/)).toBeInTheDocument()
      expect(within(panel).queryAllByRole('listitem')).toHaveLength(0)
    })

    it('hides the filter for a short list', async () => {
      details.mockImplementation((id) =>
        Promise.resolve({ ...makeDetail(id), collections: COLLECTIONS.slice(0, 2) }),
      )
      const user = userEvent.setup()
      renderPage('/products/id-7')
      await screen.findByText('Home > Desks')

      await user.click(screen.getByRole('tab', { name: /Collections/ }))

      expect(screen.getByText('In 2 collections')).toBeInTheDocument()
      expect(
        screen.queryByRole('searchbox', { name: 'Filter collections' }),
      ).not.toBeInTheDocument()
    })
  })

  describe('image lightbox', () => {
    const IMAGES = [1, 2, 3].map((n) => ({
      id: `img-${n}`,
      url: `https://cdn.example.com/p${n}.jpg`,
      alt_text: `Photo ${n}`,
      width: 800,
      height: 600,
      position: n,
      media_type: 'IMAGE',
    }))
    // The lightbox loads on demand, so the first open needs a little longer.
    const LOAD = { timeout: 8000 }
    const closeButton = () => screen.findByRole('button', { name: 'Close' }, LOAD)
    const currentSlide = () => document.querySelector('.yarl__slide_current img')

    beforeEach(() => {
      details.mockImplementation((id) =>
        Promise.resolve({
          ...makeDetail(id),
          featured_image_url: IMAGES[0].url,
          images: [
            ...IMAGES,
            // An unsafe URL must never become a thumbnail or a slide.
            { ...IMAGES[0], id: 'img-bad', url: 'javascript:alert(1)' },
          ],
        }),
      )
    })

    it('shows every image under the main one and opens the lightbox on click', async () => {
      const user = userEvent.setup()
      renderPage('/products/id-7')

      const gallery = await screen.findByRole('list', { name: 'Product media' })
      expect(within(gallery).getAllByRole('button')).toHaveLength(3)
      expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()

      await user.click(within(gallery).getByRole('button', { name: 'Open image 2 of 3' }))

      await closeButton()
      // It opens on the clicked image, and the image host gets no referrer.
      await waitFor(() => expect(currentSlide()).toHaveAttribute('src', IMAGES[1].url))
      expect(currentSlide()).toHaveAttribute('referrerpolicy', 'no-referrer')

      await user.click(await closeButton())
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument(),
      )
    }, 20000)

    it('opens the lightbox from the main image and its View Full button', async () => {
      const user = userEvent.setup()
      renderPage('/products/id-7')
      await screen.findByRole('list', { name: 'Product media' })

      await user.click(screen.getByRole('button', { name: 'View Full' }))

      await closeButton()
      await waitFor(() => expect(currentSlide()).toHaveAttribute('src', IMAGES[0].url))
    }, 20000)

    it('opens the lightbox from an image on the Media tab', async () => {
      const user = userEvent.setup()
      renderPage('/products/id-7')
      await screen.findByRole('list', { name: 'Product media' })

      await user.click(screen.getByRole('tab', { name: /Media/ }))
      const tabpanel = screen.getByRole('tabpanel')
      const buttons = within(tabpanel).getAllByRole('button', { name: /^Open image/ })
      expect(buttons).toHaveLength(3)

      await user.click(buttons[2])

      await closeButton()
      await waitFor(() => expect(currentSlide()).toHaveAttribute('src', IMAGES[2].url))
    }, 20000)
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
