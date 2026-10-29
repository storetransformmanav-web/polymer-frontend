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
  api: {
    products: { list: vi.fn(), details: vi.fn() },
    access: { tags: vi.fn() },
    shops: { list: vi.fn(() => Promise.resolve([])) },
    auth: {},
  },
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
    // With a stock filter on, the answer describes only the narrowed list (the other
    // figures read 0), as the real API does.
    stock_summary:
      params.in_stock === true
        ? { in_stock: 859, low_stock: 0, out_of_stock: 0, low_stock_threshold: 10 }
        : params.in_stock === false
          ? { in_stock: 0, low_stock: 0, out_of_stock: 407, low_stock_threshold: 10 }
          : {
              in_stock: 859,
              low_stock: 125,
              out_of_stock: 407,
              low_stock_threshold: 10,
            },
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

  it('offers every tag that is on a product, from the tags API, once the Filters grid is open', async () => {
    const user = userEvent.setup()
    const tagRow = (tag: string, products: number) => ({
      tag,
      label: null,
      is_lock_tag: false,
      products,
      locked_products: 0,
      customers: 0,
    })
    vi.mocked(api.shops.list).mockResolvedValue(
      ['polymer-uk', 'polymer-eu'].map((key, position) => ({
        id: key,
        key,
        name: key,
        domain: `${key}.myshopify.com`,
        is_active: true,
        position,
        connected: true,
        products_count: 0,
      })),
    )
    vi.mocked(api.access.tags).mockImplementation(({ shop }) =>
      Promise.resolve({
        // "b2b" is only on customers, so it is no use as a product filter.
        tags:
          shop === 'polymer-uk'
            ? [tagRow('b2b', 0), tagRow('Brand_Acme', 2)]
            : [tagRow('EU_Only', 5)],
        page: 1,
        page_size: 200,
        total: 2,
        total_pages: 1,
        has_next: false,
      }),
    )
    renderPage()
    await screen.findByText('Product 1')
    // Nothing is asked while the grid is closed.
    expect(api.access.tags).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Filters' }))

    await waitFor(() =>
      expect(
        within(screen.getByLabelText('Tag'))
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(expect.arrayContaining(['All Tags', 'Brand_Acme', 'EU_Only', 'modern'])),
    )
    expect(
      within(screen.getByLabelText('Tag')).queryByRole('option', { name: 'b2b' }),
    ).not.toBeInTheDocument()
    // With "All shops" every store is asked, one call each.
    expect(api.access.tags).toHaveBeenCalledWith({
      shop: 'polymer-uk',
      page: 1,
      page_size: 200,
    })
    expect(api.access.tags).toHaveBeenCalledWith({
      shop: 'polymer-eu',
      page: 1,
      page_size: 200,
    })
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

  it('lays the table out as (tick), Image, Product, Variants, Status, Inventory, Price, Actions', async () => {
    renderPage()
    await screen.findByText('Product 1')

    const table = screen.getByRole('table')
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((header) => header.textContent)
    expect(headers).toEqual([
      '', // the "select all on this page" checkbox
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
    // (cells: tick, image, product, variants, status, inventory, price, actions)
    expect(cells1[3]).toHaveTextContent('2')
    // Alignment classes must not conflict (a stray text-left beat text-center).
    expect(cells1[3]).toHaveClass('text-center')
    expect(cells1[3]).not.toHaveClass('text-left')
    expect(cells1[5]).toHaveClass('text-right')
    expect(cells1[5]).not.toHaveClass('text-left')
    expect(cells1[5]).toHaveTextContent('10')
    expect(within(row3).getAllByRole('cell')[5]).toHaveTextContent('Out of stock')
  })

  it('sorts from the Product, Inventory and Price headers: ascending first, then flipping, from page 1', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')

    const header = (name: string) =>
      screen.getByRole('columnheader', { name: new RegExp(`^${name}`, 'i') })
    // Only these three are sortable; none is sorted to begin with.
    for (const name of ['Product', 'Inventory', 'Price']) {
      expect(within(header(name)).getByRole('button')).toBeInTheDocument()
      expect(header(name)).not.toHaveAttribute('aria-sort')
    }
    expect(
      within(screen.getByRole('columnheader', { name: 'Status' })).queryByRole('button'),
    ).toBeNull()

    await user.click(within(header('Price')).getByRole('button'))
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'price', order: 'asc', page: 1 }),
      ),
    )
    expect(header('Price')).toHaveAttribute('aria-sort', 'ascending')

    // The same column again flips the direction.
    await user.click(within(header('Price')).getByRole('button'))
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'price', order: 'desc', page: 1 }),
      ),
    )
    expect(header('Price')).toHaveAttribute('aria-sort', 'descending')

    // Another column starts ascending, and only it is marked.
    await user.click(within(header('Product')).getByRole('button'))
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'title', order: 'asc' }),
      ),
    )
    expect(header('Product')).toHaveAttribute('aria-sort', 'ascending')
    expect(header('Price')).not.toHaveAttribute('aria-sort')

    // The Sort by / Order dropdowns in Filters follow along.
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    expect(screen.getByLabelText('Sort by')).toHaveValue('title')
    expect(screen.getByLabelText('Order')).toHaveValue('asc')

    await user.click(within(header('Inventory')).getByRole('button'))
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ sort: 'inventory', order: 'asc' }),
      ),
    )
  })

  it('shows the Variants tab as Variant (picture, name, SKU), Price and Available, with the total inventory under it', async () => {
    const user = userEvent.setup()
    renderPage('/products/id-7')
    await screen.findByRole('heading', { level: 1, name: 'Product 7' })
    await user.click(screen.getByRole('tab', { name: /Variants/ }))

    // (the hidden list's table is still mounted, so look inside the tab's panel)
    const table = screen.getByRole('tabpanel')
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Variant', 'Price', 'Available'])

    // The SKU sits under the variant's name, in the same cell.
    const cell = screen.getByRole('cell', { name: /Default Title/ })
    expect(cell).toHaveTextContent('SKU-7')

    // The footer adds it all up.
    expect(screen.getByText(/Total inventory across all locations:/)).toHaveTextContent(
      /Total inventory across all locations: \d[\d,]* available/,
    )
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
    // No counts were asked for yet: they only appear in the status dropdown, once Filters is open.
    expect(list.mock.calls.some(([params]) => params.page_size === 1)).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    // The status counts follow the same store.
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

  it('marks what was searched for in yellow in the rows, and nothing without a search', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')
    const table = screen.getByRole('table')
    expect(table.querySelector('mark')).toBeNull()

    await user.type(screen.getByRole('searchbox', { name: 'Search products' }), 'Product')
    await waitFor(() => expect(table.querySelector('mark')).not.toBeNull())

    const first = within(table).getByRole('button', { name: 'Product 1' })
    expect(first.querySelector('mark')).toHaveTextContent('Product')
    expect(first.querySelector('mark')?.className).toContain('bg-highlight')
    // The whole name is still there.
    expect(first).toHaveTextContent('Product 1')

    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    await waitFor(() => expect(table.querySelector('mark')).toBeNull())
  })

  it('filters the table when the In stock or Out of stock card is pressed, and again to show everything', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')

    const inStock = screen.getByRole('button', { name: /^In stock/ })
    const outOfStock = screen.getByRole('button', { name: /^Out of stock/ })
    // Low stock and the threshold are plain figures: the API has no filter for them.
    expect(screen.queryByRole('button', { name: /^Low stock/ })).toBeNull()
    expect(inStock).toHaveAttribute('aria-pressed', 'false')

    await user.click(inStock)
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ in_stock: true, page: 1 }),
      ),
    )
    expect(screen.getByRole('button', { name: /^In stock/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    // The other card switches the filter over, and the Stock dropdown in Filters follows.
    await user.click(screen.getByRole('button', { name: /^Out of stock/ }))
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ in_stock: false, page: 1 }),
      ),
    )
    expect(screen.getByRole('button', { name: /^Out of stock/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /^In stock/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    expect(screen.getByLabelText('Stock')).toHaveValue('out')

    // Pressing the active card again clears the filter.
    list.mockClear()
    await user.click(screen.getByRole('button', { name: /^Out of stock/ }))
    await waitFor(() => expect(list).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: /^Out of stock/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByLabelText('Stock')).toHaveValue('')
    void outOfStock
  })

  it('keeps the other stock cards’ figures when a card is pressed — it only adds the filter', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')
    const card = (label: string) =>
      screen.getAllByText(label, { selector: 'span' })[0].parentElement!.parentElement!

    await user.click(screen.getByRole('button', { name: /^In stock/ }))
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(expect.objectContaining({ in_stock: true })),
    )
    // The cards read the summary of the list without the stock filter.
    await waitFor(() =>
      expect(
        list.mock.calls.some(
          ([params]) => params.page_size === 1 && params.in_stock === undefined,
        ),
      ).toBe(true),
    )
    expect(within(card('In stock')).getByText('859')).toBeInTheDocument()
    expect(within(card('Low stock')).getByText('125')).toBeInTheDocument()
    expect(within(card('Out of stock')).getByText('407')).toBeInTheDocument()
    expect(within(card('Low stock threshold')).getByText('10')).toBeInTheDocument()

    // Switching to the other card keeps them too.
    await user.click(screen.getByRole('button', { name: /^Out of stock/ }))
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(expect.objectContaining({ in_stock: false })),
    )
    expect(within(card('In stock')).getByText('859')).toBeInTheDocument()
    expect(within(card('Low stock')).getByText('125')).toBeInTheDocument()
    expect(within(card('Out of stock')).getByText('407')).toBeInTheDocument()
  })

  it('shows the API’s four stock figures in cards on top of the list', async () => {
    renderPage()
    await screen.findByText('Product 1')

    const card = (label: string) =>
      // The cards come first ("Out of stock" is also a cell of the table).
      screen.getAllByText(label, { selector: 'span' })[0].parentElement!.parentElement!
    expect(within(card('In stock')).getByText('859')).toBeInTheDocument()
    expect(within(card('Low stock')).getByText('125')).toBeInTheDocument()
    expect(within(card('Out of stock')).getByText('407')).toBeInTheDocument()
    expect(within(card('Low stock threshold')).getByText('10')).toBeInTheDocument()
  })

  it('says under each stock figure what it counts, using the API’s threshold', async () => {
    renderPage()
    await screen.findByText('Product 1')

    expect(screen.getByText('Products with stock above 0')).toBeInTheDocument()
    expect(screen.getByText('Stock above 0 but below 10')).toBeInTheDocument()
    expect(screen.getByText('No stock: 0, negative or unknown')).toBeInTheDocument()
    expect(screen.getByText('Below this many counts as low')).toBeInTheDocument()
  })

  it('filters by the status dropdown and sends it to the API', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.selectOptions(screen.getByLabelText('Product status'), 'ARCHIVED')

    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(expect.objectContaining({ status: 'ARCHIVED' })),
    )
    expect(screen.getByLabelText('Product status')).toHaveValue('ARCHIVED')
  })

  it('shows a count on every status choice, honouring the other filters', async () => {
    list.mockImplementation((params) => {
      const byStatus = { ACTIVE: 40, DRAFT: 15, ARCHIVED: 5, UNLISTED: 0 }
      const total = params.status ? byStatus[params.status] : 60
      return Promise.resolve({ ...respond(params), total })
    })
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    const status = screen.getByLabelText('Product status')
    await waitFor(() =>
      expect(
        within(status)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['All Products (60)', 'Active (40)', 'Draft (15)', 'Archived (5)']),
    )
    // There is no Unlisted choice, and no tab strip any more (it is one dropdown).
    expect(within(status).queryByRole('option', { name: /^Unlisted/ })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Filter by status' })).toBeNull()
    // …and it is only in the Filters grid, not beside the search box.
    expect(screen.getAllByLabelText('Product status')).toHaveLength(1)

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

  it('opens with page 1 only, asks for another page when its button is clicked, and re-visits pages from cache', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')

    // Nothing but page 1 is requested when the page opens, or when a button is hovered…
    expect(callsForPage(2)).toBe(0)
    await user.hover(screen.getByRole('button', { name: 'Page 2' }))
    expect(callsForPage(2)).toBe(0)

    // …page 2 is requested by the click.
    await user.click(screen.getByRole('button', { name: 'Page 2' }))
    expect(await screen.findByText('Product 26')).toBeInTheDocument()
    expect(callsForPage(2)).toBe(1)
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 26 to 50 of 60')
    const callsBefore = list.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Page 1' }))
    // Back on a page seen before: shown at once, from the cache.
    expect(screen.getByText('Product 1')).toBeInTheDocument()

    // Page 1 was never fetched a second time, and going back asked for nothing new.
    expect(callsForPage(1)).toBe(1)
    expect(list.mock.calls.length - callsBefore).toBe(0)
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

  describe('Shopify column', () => {
    const shop = {
      key: 'polymer-uk',
      name: 'Polymer UK',
      domain: 'polymer-uk-ltd.myshopify.com',
      currency: 'GBP',
    }

    it('links each product to its page in the Shopify admin, in a new tab', async () => {
      list.mockImplementation((params) => {
        const response = respond(params)
        return Promise.resolve({
          ...response,
          items: response.items.map((item) => ({
            ...item,
            shopify_id: 15393751269761 + Number(item.id.replace('id-', '')),
            shop,
          })),
        })
      })
      renderPage()
      await screen.findByText('Product 1')

      const link = screen.getByRole('link', { name: 'Open Product 1 in Shopify' })
      expect(link).toHaveAttribute(
        'href',
        'https://admin.shopify.com/store/polymer-uk-ltd/products/15393751269762',
      )
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      // No Shopify column: the icon sits in the Product cell, right after the copy icon.
      const headers = within(screen.getByRole('table'))
        .getAllByRole('columnheader')
        .map((header) => header.textContent)
      expect(headers).not.toContain('Shopify')
      const copy = screen.getByRole('button', { name: 'Copy name of Product 1' })
      expect(copy.nextElementSibling).toBe(link)
      expect(link.closest('td')).toBe(copy.closest('td'))
      // The same box and icon size as the copy icon, so they line up.
      expect(link).toHaveClass('h-5', 'w-5')
      expect(copy).toHaveClass('h-5', 'w-5')
      // Each row links to its own product.
      expect(
        screen.getByRole('link', { name: 'Open Product 2 in Shopify' }),
      ).toHaveAttribute(
        'href',
        'https://admin.shopify.com/store/polymer-uk-ltd/products/15393751269763',
      )
    })

    it('does not open the product in the CRM when the Shopify link is used', async () => {
      list.mockImplementation((params) => {
        const response = respond(params)
        return Promise.resolve({
          ...response,
          items: response.items.map((item) => ({ ...item, shop })),
        })
      })
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Product 1')
      const link = screen.getByRole('link', { name: 'Open Product 1 in Shopify' })
      // Stop the browser from really navigating in the test.
      link.addEventListener('click', (event) => event.preventDefault())

      await user.click(link)

      expect(screen.queryByRole('heading', { level: 1, name: 'Product 1' })).toBeNull()
    })

    it('shows no link (and no stray dash) when the store address is not known', async () => {
      renderPage() // the fixture rows carry no store
      await screen.findByText('Product 1')

      expect(screen.queryByRole('link', { name: /in Shopify/ })).not.toBeInTheDocument()
    })
  })

  it('shows a copy button beside each product name, and clicking it copies just the name', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 1')

    const copy = screen.getByRole('button', { name: 'Copy name of Product 1' })
    await user.hover(screen.getByText('Product 1'))
    await user.click(copy)

    expect(await navigator.clipboard.readText()).toBe('Product 1')
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
    // Copying is not opening: the product's page did not open (hovering only prefetches).
    expect(screen.queryByRole('heading', { level: 1, name: 'Product 1' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Add product' })).toBeInTheDocument()
  })

  it('has one copy button per row, each for its own product', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Product 2')

    await user.click(screen.getByRole('button', { name: 'Copy name of Product 2' }))

    expect(await navigator.clipboard.readText()).toBe('Product 2')
    expect(
      screen.getAllByRole('button', { name: /^Copy name of / }).length,
    ).toBeGreaterThan(1)
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

    // Overview: specs, price, description shown with its structure (bold kept) but no script.
    expect(await screen.findByText('Home > Desks')).toBeInTheDocument()
    expect(screen.getByText('£25.85')).toBeInTheDocument()
    const bold = screen.getByText('walnut')
    expect(bold.tagName).toBe('STRONG')
    expect(bold.parentElement).toHaveTextContent('Sturdy walnut desk')
    expect(bold.parentElement).not.toHaveTextContent('alert')
    expect(document.querySelector('script')).toBeNull()
    // The header no longer shows a SKU; it lives in the Variants tab.
    expect(screen.queryByText('SKU-7')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Variants/ }))
    expect(screen.getByText('SKU-7')).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: /Default Title/ })).toBeInTheDocument()
    expect(screen.getByText('Unavailable')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Inventory/ }))
    expect(screen.getByText('Park Royal warehouse')).toBeInTheDocument()

    // Collections are in the Overview's Product Specifications card, not a tab of their own.
    expect(screen.queryByRole('tab', { name: /Collections/ })).toBeNull()
    await user.click(screen.getByRole('tab', { name: /Overview/ }))
    expect(
      within(screen.getByRole('list', { name: 'Collections' })).getByText(
        'Best Selling Products',
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Media/ }))
    expect(screen.getByText('This product has no images.')).toBeInTheDocument()
  })

  it("shows each variant's own picture beside its name in the Variants tab", async () => {
    const detail = makeDetail('id-7')
    detail.variants[0].image_url = 'https://cdn.example.com/variant-small.jpg'
    details.mockResolvedValue(detail)
    const user = userEvent.setup()
    renderPage('/products/id-7')
    await screen.findByRole('heading', { level: 1, name: 'Product 7' })

    await user.click(screen.getByRole('tab', { name: /Variants/ }))

    const cell = screen.getByRole('cell', { name: /Default Title/ })
    expect(cell.querySelector('img')).toHaveAttribute(
      'src',
      'https://cdn.example.com/variant-small.jpg',
    )
  })

  describe('description sections from the apd metafield', () => {
    const SETTINGS = {
      accordian_multi: false,
      sections: [
        {
          title: 'Product Description',
          content: '<p>These Hippo Microwave Containers with Lids are dependable.</p>',
          position: 0,
        },
        {
          title: 'Product Information',
          content:
            '<p><strong>Capacity:</strong></p><table><tbody><tr><td>MC01H</td><td>500ml</td></tr></tbody></table>',
          position: 1,
        },
      ],
    }

    function withApd(settings: unknown) {
      const detail = makeDetail('id-7')
      detail.metafields = [
        {
          namespace: 'apd',
          key: 'apd',
          type: 'json_string',
          value: JSON.stringify(settings),
        },
      ]
      detail.description_html = '<p>The plain store description</p>'
      details.mockResolvedValue(detail)
    }

    it('shows them on their own as an accordion — no “Description” card around them — closed', async () => {
      withApd(SETTINGS)
      const user = userEvent.setup()
      renderPage('/products/id-7')
      await screen.findByText('Home > Desks')

      const first = screen.getByRole('button', { name: /^Product Description/ })
      const second = screen.getByRole('button', { name: /^Product Information/ })
      expect(first).toHaveAttribute('aria-expanded', 'false')
      expect(second).toHaveAttribute('aria-expanded', 'false')
      // No card header of its own: the two rows are all there is (the product's own
      // description is not shown either).
      expect(screen.queryByRole('button', { name: /^Description/ })).toBeNull()
      expect(screen.queryByRole('heading', { name: 'Description' })).toBeNull()
      expect(screen.queryByText('The plain store description')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Product Details/ })).toBeNull()
      expect(screen.queryByText(/Hippo Microwave/)).not.toBeInTheDocument()

      await user.click(second)
      const region = screen.getByRole('region', { name: 'Product Information' })
      expect(within(region).getByRole('table')).toBeInTheDocument()
      expect(within(region).getByText('500ml')).toBeInTheDocument()
      // `accordian_multi: false`: opening one closes the other.
      await user.click(first)
      expect(second).toHaveAttribute('aria-expanded', 'false')
      expect(first).toHaveAttribute('aria-expanded', 'true')
    })

    it('falls back to the product description text when there are no sections', async () => {
      const detail = makeDetail('id-7')
      detail.description_html = '<p>The plain store description</p>'
      details.mockResolvedValue(detail)
      const user = userEvent.setup()
      renderPage('/products/id-7')
      await screen.findByText('Home > Desks')
      await user.click(screen.getByRole('button', { name: /^Description/ }))

      expect(screen.getByText('The plain store description')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Product Information/ })).toBeNull()
    })

    it('ignores a damaged apd value and shows the plain description', async () => {
      const detail = makeDetail('id-7')
      detail.description_html = '<p>The plain store description</p>'
      detail.metafields = [
        { namespace: 'apd', key: 'apd', type: 'json_string', value: '{not json' },
      ]
      details.mockResolvedValue(detail)
      const user = userEvent.setup()
      renderPage('/products/id-7')
      await screen.findByText('Home > Desks')
      await user.click(screen.getByRole('button', { name: /^Description/ }))

      expect(screen.getByText('The plain store description')).toBeInTheDocument()
    })
  })

  describe('metafields tab', () => {
    function withMetafields() {
      const detail = makeDetail('id-7')
      detail.metafields = [
        {
          namespace: 'custom',
          key: 'pack_materials',
          type: 'list.single_line_text_field',
          value: '["Plastic","Foil"]',
        },
        { namespace: 'custom', key: 'eco_friendly', type: 'boolean', value: 'true' },
        {
          namespace: 'apd',
          key: 'apd',
          type: 'json_string',
          value: JSON.stringify({
            accent_color: '#557b97',
            sections: [
              { title: 'Product Description', content: '<p>x</p>', position: 0 },
              { title: 'Product Information', content: '<p>y</p>', position: 1 },
            ],
          }),
        },
      ]
      detail.variants[0].metafields = [
        {
          namespace: 'my_fields',
          key: 'unit_of_sale',
          type: 'number_integer',
          value: '500',
        },
      ]
      details.mockResolvedValue(detail)
    }

    it('explains what metafields are and shows each one in plain words', async () => {
      withMetafields()
      const user = userEvent.setup()
      renderPage('/products/id-7')
      await screen.findByText('Home > Desks')
      await user.click(screen.getByRole('tab', { name: /^Metafields/ }))

      expect(screen.queryByText(/Metafields are extra details stored/)).toBeNull()
      expect(screen.getByRole('columnheader', { name: 'Detail' })).toBeInTheDocument()
      expect(screen.getByRole('columnheader', { name: 'Kind' })).toBeInTheDocument()

      const rowOf = (name: string) =>
        screen.getByText(name, { selector: 'p' }).closest('tr') as HTMLElement

      // A plain name, a plain kind and a laid-out value — no technical name underneath.
      const unit = rowOf('Unit of sale')
      expect(within(unit).getByText('Variant: Default Title')).toBeInTheDocument()
      expect(within(unit).getByText('Whole number')).toBeInTheDocument()
      expect(within(unit).getByText('500')).toBeInTheDocument()
      expect(within(unit).queryByText('my_fields.unit_of_sale')).toBeNull()
      expect(within(unit).queryByText(/My fields/)).toBeNull()

      const eco = rowOf('Eco friendly')
      expect(within(eco).getByText('Whole product')).toBeInTheDocument()
      expect(within(eco).getByText('Yes / No')).toBeInTheDocument()
      expect(within(eco).getByText('Yes')).toBeInTheDocument()

      const materials = rowOf('Pack materials')
      expect(within(materials).getByText('List of text (one line)')).toBeInTheDocument()
      expect(within(materials).getByText('Plastic')).toBeInTheDocument()
      expect(within(materials).getByText('Foil')).toBeInTheDocument()
    })

    it('says what the description-sections metafield is instead of printing its JSON', async () => {
      withMetafields()
      const user = userEvent.setup()
      renderPage('/products/id-7')
      await screen.findByText('Home > Desks')
      await user.click(screen.getByRole('tab', { name: /^Metafields/ }))

      const row = screen
        .getByText('Description sections', { selector: 'p' })
        .closest('tr') as HTMLElement
      expect(
        within(row).getByText(/2 sections: Product Description, Product Information/),
      ).toBeInTheDocument()
      expect(within(row).getByText(/Shown in the Description card/)).toBeInTheDocument()
      // The long JSON string is not dumped into the table: it is only inside "View original value".
      expect(within(row).getByText('View original value')).toBeInTheDocument()
      expect(
        within(row)
          .getByText(/accent_color/)
          .closest('details'),
      ).not.toBeNull()
    })
  })

  it('starts with Description collapsed, Specifications open', async () => {
    const user = userEvent.setup()
    renderPage('/products/id-7')
    await screen.findByText('Home > Desks')

    const section = (name: string) =>
      screen.getByRole('button', { name: new RegExp(`^${name}`) })
    expect(section('Product Specifications')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.queryByRole('button', { name: /^Status & Launch/ })).toBeNull()
    expect(section('Description')).toHaveAttribute('aria-expanded', 'false')

    await user.click(section('Description'))
    expect(section('Description')).toHaveAttribute('aria-expanded', 'true')
  })

  describe('collections in the Product Specifications card', () => {
    const COLLECTIONS = Array.from({ length: 10 }, (_, i) => ({
      id: `col-${i}`,
      shopify_id: 100 + i,
      title: i === 0 ? 'Food Packaging' : `Collection ${i}`,
      handle: i === 0 ? 'food-packaging' : `collection-${i}`,
      collection_type: i === 9 ? 'custom' : 'smart',
    }))

    it('lists every collection as a chip under Tags, with its type and handle as hover text', async () => {
      details.mockImplementation((id) =>
        Promise.resolve({ ...makeDetail(id), collections: COLLECTIONS }),
      )
      renderPage('/products/id-7')
      await screen.findByText('Home > Desks')

      const list = screen.getByRole('list', { name: 'Collections' })
      expect(within(list).getAllByRole('listitem')).toHaveLength(10)
      expect(within(list).getByText('Food Packaging').closest('li')).toHaveAttribute(
        'title',
        'Smart collection · food-packaging',
      )
      expect(within(list).getByText('Collection 9').closest('li')).toHaveAttribute(
        'title',
        'Manual collection · collection-9',
      )

      // After the Tags block, in the same card.
      const tags = screen.getByRole('heading', { name: 'Tags' })
      const heading = screen.getByRole('heading', { name: 'Collections' })
      expect(
        tags.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    })

    it('says so when the product is in no collection', async () => {
      details.mockImplementation((id) =>
        Promise.resolve({ ...makeDetail(id), collections: [] }),
      )
      renderPage('/products/id-7')
      await screen.findByText('Home > Desks')

      expect(
        screen.getByText("This product isn't in any collection."),
      ).toBeInTheDocument()
      expect(screen.queryByRole('list', { name: 'Collections' })).toBeNull()
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
      mime_type: 'image/jpeg',
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

    it('shows the image’s information beside it — name, alt text, type and size, id — and follows the picture when paging', async () => {
      const user = userEvent.setup()
      details.mockImplementation((id) =>
        Promise.resolve({
          ...makeDetail(id),
          featured_image_url: IMAGES[0].url,
          images: [IMAGES[0], { ...IMAGES[1], alt_text: '' }, IMAGES[2]],
        }),
      )
      renderPage('/products/id-7')
      const gallery = await screen.findByRole('list', { name: 'Product media' })

      await user.click(within(gallery).getByRole('button', { name: 'Open image 1 of 3' }))
      await closeButton()
      const panel = () => screen.getByRole('complementary', { name: 'Image information' })
      expect(
        within(panel()).getByRole('heading', { name: 'Information' }),
      ).toBeInTheDocument()
      // The picture's own record: file name (from its address), alt text, type and
      // size in pixels, and its id.
      const first = within(panel())
      expect(first.getByText('Name')).toBeInTheDocument()
      expect(first.getByText('p1.jpg')).toBeInTheDocument()
      expect(first.getByText('Photo 1')).toBeInTheDocument()
      expect(first.getByText('JPG · 800 × 600 px')).toBeInTheDocument()
      expect(first.getByText('img-1')).toBeInTheDocument()
      expect(first.getByRole('button', { name: 'Copy image ID' })).toBeInTheDocument()

      // The second picture: its own details, and it has no alt text.
      await user.click(screen.getByRole('button', { name: 'Next' }))
      await waitFor(() =>
        expect(within(panel()).getByText('No alt text')).toBeInTheDocument(),
      )
      expect(within(panel()).getByText('p2.jpg')).toBeInTheDocument()
      expect(within(panel()).getByText('img-2')).toBeInTheDocument()
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

  it('has no Raw data tab, and never asks for the raw Shopify payload', async () => {
    renderPage('/products/id-7')
    await screen.findByText('Home > Desks')

    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent)
    expect(tabs.some((label) => /raw/i.test(label ?? ''))).toBe(false)
    expect(screen.queryByRole('tab', { name: 'Raw data' })).not.toBeInTheDocument()
    expect(details).not.toHaveBeenCalledWith('id-7', true)
    expect(details).toHaveBeenCalledWith('id-7', false)
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
