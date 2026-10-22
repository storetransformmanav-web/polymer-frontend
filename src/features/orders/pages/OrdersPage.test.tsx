import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shopSelected } from '../../../app/store/shopSlice.ts'
import { ApiError } from '../../../lib/api/ApiError.ts'
import {
  api,
  type OrderListItem,
  type OrderListParams,
  type OrderListResponse,
} from '../../../lib/api/endpoints.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { OrdersPage } from './OrdersPage.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: { orders: { list: vi.fn() }, products: {}, customers: {}, auth: {} },
}))

const TOTAL = 60
const SHOP = {
  key: 'polymer-uk',
  name: 'Packaging By Polymer',
  domain: 'polymer-uk-ltd.myshopify.com',
  currency: 'GBP',
}

/**
 * Order #N: #1 is a guest checkout (no customer in the CRM), #2 was partly refunded and
 * cancelled, #3 is paid and fulfilled, #5 is pending and on hold; the rest are authorized.
 */
function makeOrder(n: number): OrderListItem {
  const guest = n === 1
  return {
    id: `order-${n}`,
    shopify_id: 14000000000000 + n,
    name: `#${17000 + n}`,
    order_number: 17000 + n,
    email: `buyer${n}@example.com`,
    customer: guest
      ? { id: null, full_name: null, email: null, phone: null, orders_count: null }
      : {
          id: `cust-${n}`,
          full_name: `Customer ${n}`,
          email: `buyer${n}@example.com`,
          phone: null,
          orders_count: n,
        },
    shop: SHOP,
    currency: 'GBP',
    subtotal_price: '12.50',
    total_discounts: '0.00',
    total_shipping: '9.58',
    total_tax: '4.42',
    total_price: n === 3 ? '193.50' : '26.50',
    total_refunded: n === 2 ? '5.00' : '0.00',
    net_payment: n === 3 ? '193.50' : '0.00',
    financial_status:
      n === 3
        ? 'PAID'
        : n === 5
          ? 'PENDING'
          : n === 2
            ? 'PARTIALLY_REFUNDED'
            : 'AUTHORIZED',
    fulfillment_status:
      n === 3
        ? 'FULFILLED'
        : n === 5
          ? 'ON_HOLD'
          : n === 4
            ? 'PARTIALLY_FULFILLED'
            : 'UNFULFILLED',
    return_status: 'NO_RETURN',
    payment_gateway_names: [n === 5 ? 'manual' : 'shopify_payments'],
    source_name: n === 5 ? '4974139' : n === 6 ? 'shopify_draft_order' : 'web',
    tags:
      n === 6
        ? ['b2b', 'Expected Delivery Day: Wednesday', 'VIP']
        : ['Expected Delivery Day: Wednesday'],
    items_count: n + 1,
    line_items_preview: ['Pizza Box White Plain, Square', 'White Paper Carrier Bag'],
    shopify_created_at: '2026-10-22T07:48:51Z',
    shopify_updated_at: '2026-10-22T07:48:59Z',
    cancelled_at: n === 2 ? '2026-10-22T09:00:00Z' : null,
    closed_at: null,
  }
}

/** A fake server: 60 orders, paged by the request's page/page_size, with the API's `totals`. */
function respond(params: OrderListParams): OrderListResponse {
  const page = params.page ?? 1
  const pageSize = params.page_size ?? 20
  const matches = params.search === 'nomatch' ? 0 : TOTAL
  const start = (page - 1) * pageSize
  const count = Math.max(0, Math.min(pageSize, matches - start))

  return {
    items: Array.from({ length: count }, (_, i) => makeOrder(start + i + 1)),
    totals: {
      orders: matches,
      total_price: '593213.32',
      total_refunded: '1452.65',
      net_payment: '375118.93',
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

const list = vi.mocked(api.orders.list)
// One-row requests are the fulfillment tabs' counts, not pages of the list.
const isCountQuery = (params: OrderListParams) => params.page_size === 1
const pageCalls = () => list.mock.calls.filter(([params]) => !isCountQuery(params))
const callsForPage = (page: number) =>
  pageCalls().filter(([params]) => params.page === page).length

describe('OrdersPage', () => {
  beforeEach(() => {
    list.mockImplementation((params) => Promise.resolve(respond(params)))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads the first page from the API with the default query', async () => {
    renderWithProviders(<OrdersPage />)

    expect(await screen.findByText('17002')).toBeInTheDocument()
    expect(list).toHaveBeenCalledWith({
      sort: 'created_at',
      order: 'desc',
      page: 1,
      page_size: 25,
    })
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 1 to 25 of 60 entries')
  })

  it('shows these columns: order number, customer name, email, store, currency, financial and fulfillment status, items, total price, and the view button', async () => {
    renderWithProviders(<OrdersPage />)
    await screen.findByText('17002')

    const table = within(screen.getByRole('table'))
    const row = (name: string) => table.getByText(name).closest('tr')!
    expect(
      table.getAllByRole('columnheader').map((header) => header.textContent),
    ).toEqual([
      'Order',
      'Customer name',
      'Email',
      'Store',
      'Currency',
      'Financial status',
      'Fulfillment status',
      'Items',
      'Total price',
      'Actions',
    ])

    // #3: Customer 3, paid and fulfilled, 4 items, £193.50, GBP, Packaging By Polymer.
    const paid = within(row('17003'))
    const cells = paid.getAllByRole('cell').map((cell) => cell.textContent)
    expect(cells.slice(0, 9)).toEqual([
      '17003',
      'Customer 3',
      'buyer3@example.com',
      'Packaging By Polymer',
      'GBP',
      'Paid',
      'Fulfilled',
      '4',
      '£193.50',
    ])
    expect(paid.getByRole('button', { name: 'View order 17003' })).toBeInTheDocument()

    // Nothing else of the order is in the table: no date, source, products.
    expect(paid.queryByText('22 Oct 2026')).toBeNull()
    expect(paid.queryByText('Online store')).toBeNull()
    expect(paid.queryByText(/Pizza Box/)).toBeNull()
    // #5 is pending and on hold; #4 is partly fulfilled.
    expect(within(row('17005')).getByText('Pending')).toBeInTheDocument()
    expect(within(row('17005')).getByText('On hold')).toBeInTheDocument()
    expect(within(row('17004')).getByText('Partially fulfilled')).toBeInTheDocument()
  })

  it('shows the order number only in the Order column — no hashtag, no products', async () => {
    renderWithProviders(<OrdersPage />)
    await screen.findByText('17002')

    const cell = screen.getByText('17002').closest('td')!
    expect(cell).toHaveTextContent(/^17002$/)
    expect(screen.queryByText(/Pizza Box White Plain/)).toBeNull()
    expect(screen.queryByText(/White Paper Carrier Bag/)).toBeNull()
  })

  it('shows the customer object’s name and email, and dashes for a guest checkout — not the order’s own email', async () => {
    renderWithProviders(<OrdersPage />)
    await screen.findByText('17001')

    const customer = within(screen.getByText('17002').closest('tr')!)
    expect(customer.getByText('Customer 2')).toBeInTheDocument()
    expect(customer.getByText('buyer2@example.com')).toBeInTheDocument()

    // #1 was placed by someone who is not a customer in the CRM (every field null): its own
    // email (buyer1@…) is not shown as the customer. Name and email are dashes.
    const guest = screen.getByText('17001').closest('tr')!
    expect(within(guest).queryByText('buyer1@example.com')).toBeNull()
    const cells = within(guest).getAllByRole('cell')
    expect(cells[1]).toHaveTextContent('—')
    expect(cells[2]).toHaveTextContent('—')
  })

  it('marks a cancelled order, and a part-refunded one, by its payment pill', async () => {
    renderWithProviders(<OrdersPage />)
    await screen.findByText('17002')

    const row = within(screen.getByText('17002').closest('tr')!)
    expect(row.getByText('Cancelled')).toBeInTheDocument()
    expect(row.getByText('Partially refunded')).toBeInTheDocument()
    expect(
      within(screen.getByText('17003').closest('tr')!).queryByText('Cancelled'),
    ).toBeNull()
  })

  it('shows the totals of every matching order, from the API', async () => {
    renderWithProviders(<OrdersPage />)
    await screen.findByText('17002')

    // The four figures of the API's `totals`, in its order: orders, total_price,
    // total_refunded, net_payment (the fake server's totals say 60 orders).
    const card = (label: string) =>
      screen.getAllByText(label)[0].parentElement!.parentElement!
    expect(within(card('Orders')).getByText('60')).toBeInTheDocument()
    expect(within(card('Total price')).getByText('£593,213.32')).toBeInTheDocument()
    expect(within(card('Total refunded')).getByText('£1,452.65')).toBeInTheDocument()
    expect(within(card('Net payment')).getByText('£375,118.93')).toBeInTheDocument()
    // Exactly four figures, and no worked-out ones.
    expect(screen.queryByText('Avg order value')).not.toBeInTheDocument()
    expect(screen.queryByText('Revenue')).not.toBeInTheDocument()
  })

  it('searches after a short pause, returns to page 1, and recovers from an empty result', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OrdersPage />)
    await screen.findByText('17002')

    await user.type(screen.getByRole('searchbox', { name: 'Search orders' }), 'nomatch')

    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'nomatch', page: 1 }),
      ),
    )
    expect(await screen.findByText('No orders found')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear all filters' }))
    expect(await screen.findByText('17002')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search orders' })).toHaveValue('')
  })

  it('filters by fulfillment tab and by payment', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OrdersPage />)
    await screen.findByText('17002')

    await user.click(screen.getByRole('button', { name: /^Unfulfilled/ }))
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ fulfillment_status: 'UNFULFILLED', page_size: 25 }),
      ),
    )
    expect(screen.getByRole('button', { name: /^Unfulfilled/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.selectOptions(screen.getByLabelText('Payment'), 'PAID')
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({
          fulfillment_status: 'UNFULFILLED',
          financial_status: 'PAID',
          page: 1,
        }),
      ),
    )
  })

  it('asks for no status on "All Orders"', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<OrdersPage />)
    await screen.findByText('17002')
    await user.click(screen.getByRole('button', { name: /^On hold/ }))
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ fulfillment_status: 'ON_HOLD' }),
      ),
    )

    await user.click(screen.getByRole('button', { name: /^All Orders/ }))

    // Cached already, so it shows at once; the filter is simply cleared.
    expect(screen.getByRole('button', { name: /^All Orders/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(store.getState().orders.filters.fulfillment).toBe('')
    expect(screen.getByText('17002')).toBeInTheDocument()
  })

  it('starts with the filter grid collapsed and reveals it from the Filters button', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OrdersPage />)
    await screen.findByText('17002')

    const toggle = screen.getByRole('button', { name: 'Filters' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('order-filter-grid')).toHaveAttribute('inert')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('order-filter-grid')).not.toHaveAttribute('inert')
  })

  it('sends source, cancelled, total, sort and order filters', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OrdersPage />)
    await screen.findByText('17002')
    await user.click(screen.getByRole('button', { name: 'Filters' }))

    await user.selectOptions(screen.getByLabelText('Source'), 'draft_order')
    await user.selectOptions(screen.getByLabelText('Cancelled'), 'yes')
    await user.type(screen.getByLabelText('Min total'), '100')
    await user.type(screen.getByLabelText('Max total'), '1000')
    await user.selectOptions(screen.getByLabelText('Sort by'), 'total')
    await user.selectOptions(screen.getByLabelText('Order'), 'asc')

    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'draft_order',
          cancelled: true,
          min_total: 100,
          max_total: 1000,
          sort: 'total',
          order: 'asc',
          page: 1,
        }),
      ),
    )
  })

  it('"Not cancelled" is sent as cancelled=false, and "Any" leaves it out', async () => {
    const user = userEvent.setup()
    const { store } = renderWithProviders(<OrdersPage />)
    await screen.findByText('17002')
    await user.click(screen.getByRole('button', { name: 'Filters' }))

    await user.selectOptions(screen.getByLabelText('Cancelled'), 'no')
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(expect.objectContaining({ cancelled: false })),
    )

    await user.selectOptions(screen.getByLabelText('Cancelled'), '')
    expect(store.getState().orders.filters.cancelled).toBe('')
    expect(screen.getByLabelText('Cancelled')).toHaveValue('')
    expect(screen.getByText('17002')).toBeInTheDocument()
  })

  it('filters by a date range, sent as the first and last moment of the days', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OrdersPage />)
    await screen.findByText('17002')
    await user.click(screen.getByRole('button', { name: 'Filters' }))

    await user.click(screen.getByRole('button', { name: /^Date range:/ }))
    await user.click(screen.getByRole('option', { name: 'Last 7 Days' }))

    await waitFor(() => {
      const withDates = pageCalls().find(([params]) => params.from && params.to)
      expect(withDates).toBeDefined()
      const { from, to } = withDates![0]
      // Whole days in the user's time zone: 00:00:00 … 23:59:59 local.
      expect(new Date(from!).getHours()).toBe(0)
      expect(new Date(from!).getMinutes()).toBe(0)
      expect(new Date(to!).getHours()).toBe(23)
      expect(new Date(to!).getMinutes()).toBe(59)
      expect(new Date(to!).getTime()).toBeGreaterThan(new Date(from!).getTime())
    })
  })

  it('offers tags and payment gateways seen so far and filters by them', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OrdersPage />)
    await screen.findByText('17002')
    await user.click(screen.getByRole('button', { name: 'Filters' }))

    const tag = screen.getByLabelText('Tag')
    expect(within(tag).getByRole('option', { name: 'b2b' })).toBeInTheDocument()
    await user.selectOptions(tag, 'b2b')
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(expect.objectContaining({ tag: 'b2b' })),
    )

    const gateway = screen.getByLabelText('Payment gateway')
    expect(within(gateway).getByRole('option', { name: 'manual' })).toBeInTheDocument()
    await user.selectOptions(gateway, 'manual')
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ tag: 'b2b', gateway: 'manual' }),
      ),
    )
  })

  it('queries the store picked in the top bar', async () => {
    const { store } = renderWithProviders(<OrdersPage />)
    await screen.findByText('17002')
    expect(list.mock.calls.every(([params]) => !('shop' in params))).toBe(true)

    store.dispatch(shopSelected('polymer-uk'))

    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ shop: 'polymer-uk', page: 1 }),
      ),
    )
  })

  it('shows the next page instantly (prefetched) and re-visits pages from cache', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OrdersPage />)
    await screen.findByText('17002')

    // Page 2 is requested in the background without being asked for.
    await waitFor(() => expect(callsForPage(2)).toBe(1))
    const callsBefore = pageCalls().length

    await user.click(screen.getByRole('button', { name: 'Page 2' }))
    // No await/findBy: the rows are there in the same render as the click.
    expect(screen.getByText('17026')).toBeInTheDocument()
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 26 to 50 of 60')

    await user.click(screen.getByRole('button', { name: 'Page 1' }))
    expect(screen.getByText('17002')).toBeInTheDocument()

    // Page 1 was never fetched a second time; only page 3 was prefetched.
    expect(callsForPage(1)).toBe(1)
    expect(pageCalls().length - callsBefore).toBeLessThanOrEqual(1)
  })

  it('shows a tab visited before again with no loading, from the cache', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OrdersPage />)
    await screen.findByText('17002')
    await user.click(screen.getByRole('button', { name: /^Fulfilled/ }))
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ fulfillment_status: 'FULFILLED', page_size: 25 }),
      ),
    )
    await screen.findByText('17002')

    list.mockClear()
    await user.click(screen.getByRole('button', { name: /^All Orders/ }))

    // The rows are there in the same render, with no loading state in between.
    expect(screen.getByText('17002')).toBeInTheDocument()
    expect(screen.queryByText('Loading orders…')).not.toBeInTheDocument()
    expect(callsForPage(1)).toBe(0)
  })

  it('changes the page size', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OrdersPage />)
    await screen.findByText('17002')

    await user.selectOptions(screen.getByLabelText('Entries per page'), '10')

    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ page_size: 10, page: 1 }),
      ),
    )
    expect(await screen.findByText(/Showing/)).toHaveTextContent('Showing 1 to 10 of 60')
  })

  it('shows the backend error and recovers on retry', async () => {
    // The list request fails once; the tabs' count requests are unaffected.
    let failList = true
    list.mockImplementation((params) =>
      failList && !isCountQuery(params)
        ? Promise.reject(new ApiError('Not logged in.', { status: 401 }))
        : Promise.resolve(respond(params)),
    )
    const user = userEvent.setup()
    renderWithProviders(<OrdersPage />)

    expect(await screen.findByText("Couldn't load orders")).toBeInTheDocument()
    expect(screen.getByText('Not logged in.')).toBeInTheDocument()

    failList = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('17002')).toBeInTheDocument()
  })

  it('shows a count on every fulfillment tab, honouring the other filters', async () => {
    list.mockImplementation((params) => {
      const byStatus = {
        UNFULFILLED: 30,
        PARTIALLY_FULFILLED: 5,
        FULFILLED: 20,
        ON_HOLD: 1,
      }
      const total = params.fulfillment_status ? byStatus[params.fulfillment_status] : 56
      return Promise.resolve({ ...respond(params), total })
    })
    const user = userEvent.setup()
    renderWithProviders(<OrdersPage />)
    await screen.findByText('17002')

    const tabs = screen.getByRole('group', { name: 'Filter by fulfillment' })
    expect(
      await within(tabs).findByRole('button', { name: /^All Orders\s*56$/ }),
    ).toBeInTheDocument()
    expect(
      within(tabs).getByRole('button', { name: /^Unfulfilled\s*30$/ }),
    ).toBeInTheDocument()
    expect(
      within(tabs).getByRole('button', { name: /^Partially fulfilled\s*5$/ }),
    ).toBeInTheDocument()
    expect(
      within(tabs).getByRole('button', { name: /^Fulfilled\s*20$/ }),
    ).toBeInTheDocument()
    expect(
      within(tabs).getByRole('button', { name: /^On hold\s*1$/ }),
    ).toBeInTheDocument()

    // The search narrows every tab's count (the count queries carry it).
    await user.type(screen.getByRole('searchbox', { name: 'Search orders' }), '1001')
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({
          search: '1001',
          fulfillment_status: 'UNFULFILLED',
          page_size: 1,
        }),
      ),
    )
  })

  it('keeps the previous results on screen, dimmed, while a new query loads', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OrdersPage />)
    await screen.findByText('17002')

    // Anything new never arrives (the tab counts still do).
    list.mockImplementation((params) =>
      isCountQuery(params)
        ? Promise.resolve(respond(params))
        : new Promise<never>(() => undefined),
    )
    await user.click(screen.getByRole('button', { name: /^Unfulfilled/ }))

    expect(screen.getByText('17002')).toBeInTheDocument()
    expect(screen.getByRole('table').parentElement).toHaveAttribute('aria-busy', 'true')
  })

  it('has the order-management layout: figures, then one card with the search row (with the order date) and the tabs, then the table', async () => {
    renderWithProviders(<OrdersPage />)
    await screen.findByText('17002')

    const order = (element: HTMLElement) =>
      [...document.querySelectorAll('*')].indexOf(element)
    const kpi = screen.getAllByText('Total price')[0]
    const tabs = screen.getByRole('group', { name: 'Filter by fulfillment' })
    const search = screen.getByRole('searchbox', { name: 'Search orders' })
    const table = screen.getByRole('table')
    expect(order(kpi)).toBeLessThan(order(search))
    expect(order(search)).toBeLessThan(order(tabs))
    expect(order(tabs)).toBeLessThan(order(table))
    // The tabs are in the same card as the search, like the products list.
    expect(search.closest('section')).toContainElement(tabs)
    expect(search.closest('section')).toContainElement(
      screen.getByRole('button', { name: 'Filters' }),
    )
    // The date range is in the search row, not in the collapsed grid.
    expect(screen.getByText('Order Date')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Date range:/ })).toBeVisible()
    expect(document.getElementById('order-filter-grid')).toHaveAttribute('inert')
  })

  it('fills the height it is given, with the table scrolling in its own box under a sticky header', async () => {
    renderWithProviders(<OrdersPage />)
    await screen.findByText('17002')

    // The page and the orders card take the height the layout gives them (lg and up)…
    const card = screen.getByRole('region', { name: 'Orders' })
    expect(card.className).toContain('lg:flex-1')
    expect(card.className).toContain('lg:min-h-0')
    expect(card.parentElement!.className).toContain('lg:flex-1')
    // …and the table scrolls inside its own box, so the page does not have to.
    const table = screen.getByRole('table')
    const box = table.parentElement!
    expect(box.className).toContain('overflow-auto')
    expect(box.className).toContain('flex-1')
    expect(box.className).toContain('min-h-0')
    // Wider than a narrow window: it scrolls sideways instead of squeezing.
    expect(table.className).toContain('min-w-[1180px]')
    // The header stays put while the rows scroll.
    for (const header of within(table).getAllByRole('columnheader')) {
      expect(header.className).toContain('sticky')
    }
    // The paging is outside the scrolling box, so it stays in view.
    expect(box.contains(screen.getByText(/Showing/))).toBe(false)
  })

  it('draws the tabs like the products list’s: a segmented pill group, the open one raised', async () => {
    renderWithProviders(<OrdersPage />)
    await screen.findByText('17002')

    const tabs = screen.getByRole('group', { name: 'Filter by fulfillment' })
    expect(tabs.className).toContain('rounded-xl')
    expect(tabs.className).toContain('bg-surface')
    const open = within(tabs).getByRole('button', { name: /^All Orders/ })
    expect(open.className).toContain('bg-bg')
    expect(open.className).toContain('shadow-sm')
    const other = within(tabs).getByRole('button', { name: /^Fulfilled/ })
    expect(other.className).toContain('bg-transparent')
    expect(other.className).not.toContain('shadow-sm')
  })

  it('draws no hidden scrollbar any more: the page leaves its own scrollbar alone', async () => {
    renderWithProviders(<OrdersPage />)
    await screen.findByText('17002')

    expect(document.documentElement).not.toHaveAttribute('data-hide-scrollbar')
  })

  it('keeps the filter grid compact: narrow columns, short controls, small text', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OrdersPage />)
    await screen.findByText('17002')
    await user.click(screen.getByRole('button', { name: 'Filters' }))

    const grid = document.getElementById('order-filter-grid')!.querySelector('.grid')!
    expect(grid.className).toContain('xl:grid-cols-6')
    expect(grid.className).toContain('2xl:grid-cols-9')
    for (const label of [
      'Payment',
      'Source',
      'Payment gateway',
      'Tag',
      'Cancelled',
      'Sort by',
      'Order',
    ]) {
      const select = screen.getByLabelText(label)
      expect(select.className, label).toContain('h-8')
      expect(select.className, label).toContain('text-[0.76rem]')
    }
    for (const label of ['Min total', 'Max total']) {
      const input = screen.getByLabelText(label)
      expect(input.className, label).toContain('h-8')
      expect(input.className, label).toContain('text-[0.76rem]')
    }
  })

  it('lines up the status pills: one width, centred in their columns', async () => {
    renderWithProviders(<OrdersPage />)
    await screen.findByText('17002')

    const table = within(screen.getByRole('table'))
    const payment = table.getByRole('columnheader', { name: 'Financial status' })
    expect(payment.className).toContain('text-center')
    expect(payment.className).toContain('w-40')

    const fulfillment = table.getByRole('columnheader', { name: 'Fulfillment status' })
    expect(fulfillment.className).toContain('text-center')
    expect(fulfillment.className).toContain('w-40')

    // Every pill in the two columns has the same width and is centred in its cell.
    const widths = new Set<string>()
    for (const row of table.getAllByRole('row').slice(1)) {
      for (const index of [5, 6]) {
        const cell = within(row).getAllByRole('cell')[index]
        expect(cell.className).toContain('text-center')
        for (const pill of cell.querySelectorAll('span.rounded-full')) {
          expect(pill.className).toContain('justify-center')
          widths.add(pill.className.match(/w-\d+/)![0])
        }
      }
    }
    expect([...widths]).toEqual(['w-32'])
    // The Cancelled pill sits under the payment one, the same size.
    const cancelled = within(table.getByText('17002').closest('tr')!).getByText(
      'Cancelled',
    )
    expect(cancelled.className).toContain('w-32')
  })
})
