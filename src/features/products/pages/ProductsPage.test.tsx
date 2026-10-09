import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  api,
  type ProductListItem,
  type ProductListParams,
  type ProductListResponse,
} from '../../../lib/api/endpoints.ts'
import { ApiError } from '../../../lib/api/ApiError.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { ProductsPage } from './ProductsPage.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: { products: { list: vi.fn() }, auth: {} },
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

const list = vi.mocked(api.products.list)
const callsForPage = (page: number) =>
  list.mock.calls.filter(([params]) => params.page === page).length

describe('ProductsPage', () => {
  beforeEach(() => {
    list.mockImplementation((params) => Promise.resolve(respond(params)))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads the first page from the API with the default query', async () => {
    renderWithProviders(<ProductsPage />)

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
    renderWithProviders(<ProductsPage />)
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
    renderWithProviders(<ProductsPage />)
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
    renderWithProviders(<ProductsPage />)
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
    renderWithProviders(<ProductsPage />)
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
    renderWithProviders(<ProductsPage />)
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
    renderWithProviders(<ProductsPage />)

    expect(await screen.findByText("Couldn't load products")).toBeInTheDocument()
    expect(screen.getByText('Not logged in.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Product 1')).toBeInTheDocument()
  })

  it('opens product details instantly, tracks recents, and closes on Escape', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProductsPage />)
    await screen.findByText('Product 1')

    await user.click(screen.getByRole('button', { name: 'View Product 3' }))

    const dialog = screen.getByRole('dialog', { name: 'Product 3 details' })
    expect(within(dialog).getByText('Vendor 1')).toBeInTheDocument()
    expect(within(dialog).getByText('Out of stock')).toBeInTheDocument()
    expect(within(dialog).getByText('tag-3')).toBeInTheDocument()

    const recent = screen.getByRole('navigation', { name: 'Recently viewed products' })
    expect(within(recent).getByText('handle-3')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Reopen from the recent strip, then clear it.
    await user.click(within(recent).getByRole('button', { name: /handle-3/ }))
    expect(screen.getByRole('dialog', { name: 'Product 3 details' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await user.click(within(recent).getByRole('button', { name: 'Clear' }))
    expect(
      screen.queryByRole('navigation', { name: 'Recently viewed products' }),
    ).not.toBeInTheDocument()
  })
})
