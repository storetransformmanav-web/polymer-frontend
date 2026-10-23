import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api/ApiError.ts'
import {
  api,
  type CustomerListItem,
  type CustomerListParams,
  type CustomerListResponse,
} from '../../../lib/api/endpoints.ts'
import { shopSelected } from '../../../app/store/shopSlice.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { CustomersPage } from './CustomersPage.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: { customers: { list: vi.fn() }, products: {}, auth: {} },
}))

const TOTAL = 60

/** Customer N: #1 is a CRM administrator, the rest are Shopify subscribers. */
function makeCustomer(n: number): CustomerListItem {
  const crm = n === 1
  return {
    id: `cust-${n}`,
    shopify_id: crm ? null : 1000 + n,
    email: `customer${n}@example.com`,
    full_name: n === 3 ? null : `Customer ${n}`,
    first_name: n === 3 ? 'Ian' : null,
    last_name: n === 3 ? 'Rayner' : null,
    phone: null,
    role: crm ? 'administrator' : 'subscriber',
    is_active: true,
    shopify_state: crm ? null : n % 5 === 0 ? 'INVITED' : 'ENABLED',
    accepts_marketing: crm ? null : n % 2 === 0,
    verified_email: crm ? null : n % 2 === 0,
    orders_count: n % 4,
    total_spent: n % 4 === 0 ? '0.00' : '45.70',
    currency: crm ? null : 'GBP',
    tags: n === 2 ? ['Shop', 'VIP', 'Wholesale'] : [],
    city: n % 4 === 0 ? 'Winchester' : null,
    country: crm ? null : 'United Kingdom',
    last_order_name: null,
    shopify_created_at: crm ? null : '2026-10-08T12:55:03Z',
    last_login_at: crm ? '2026-10-12T04:51:21Z' : null,
  }
}

/** A fake server: 60 customers, paged by the request's page/page_size. */
function respond(params: CustomerListParams): CustomerListResponse {
  const page = params.page ?? 1
  const pageSize = params.page_size ?? 20
  const matches = params.search === 'nomatch' ? 0 : TOTAL
  const start = (page - 1) * pageSize
  const count = Math.max(0, Math.min(pageSize, matches - start))

  return {
    items: Array.from({ length: count }, (_, i) => makeCustomer(start + i + 1)),
    page,
    page_size: pageSize,
    total: matches,
    total_pages: Math.max(1, Math.ceil(matches / pageSize)),
    has_next: start + count < matches,
    sort: params.sort ?? 'created_at',
    order: params.order ?? 'desc',
  }
}

const list = vi.mocked(api.customers.list)
// One-row requests are the role tabs' counts, not pages of the list.
const isCountQuery = (params: CustomerListParams) => params.page_size === 1
const pageCalls = () => list.mock.calls.filter(([params]) => !isCountQuery(params))
const callsForPage = (page: number) =>
  pageCalls().filter(([params]) => params.page === page).length

describe('CustomersPage', () => {
  beforeEach(() => {
    list.mockImplementation((params) => Promise.resolve(respond(params)))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads the first page from the API with the default query', async () => {
    renderWithProviders(<CustomersPage />)

    expect(await screen.findByText('Customer 2')).toBeInTheDocument()
    // Every role is asked for explicitly: the API's own default is 'subscriber' only.
    expect(list).toHaveBeenCalledWith({
      role: 'all',
      sort: 'created_at',
      order: 'desc',
      page: 1,
      page_size: 25,
    })
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 1 to 25 of 60 entries')
    expect(screen.getByText('customer2@example.com')).toBeInTheDocument()
  })

  it('shows every column by default: Customer name, Email verified, Orders, Amount spent, Role, Joined, Last login, Actions', async () => {
    renderWithProviders(<CustomersPage />)
    await screen.findByText('Customer 2')

    const table = within(screen.getByRole('table'))
    const headers = table.getAllByRole('columnheader').map((header) => header.textContent)
    expect(headers).toEqual([
      'Customer name',
      'Email verified',
      'Orders',
      'Amount spent',
      'Role',
      'Joined',
      'Last login',
      'Actions',
    ])
    expect(table.queryByRole('checkbox')).toBeNull()

    // #2: Shopify subscriber with money spent and a verified email.
    const row = table.getByText('Customer 2').closest('tr')!
    expect(within(row).getByText('customer2@example.com')).toBeInTheDocument()
    expect(within(row).getByText('Verified')).toBeInTheDocument()
    expect(within(row).getByText('£45.70')).toBeInTheDocument()
    // #3 has not verified; #1 (CRM) has no flag at all.
    expect(
      within(table.getByText('Ian Rayner').closest('tr')!).getByText('Not verified'),
    ).toBeInTheDocument()
    // The old Email subscription column is gone.
    expect(table.queryByRole('columnheader', { name: 'Email subscription' })).toBeNull()
    // Store, note, location, state and tags are not columns at all.
    for (const name of ['Store', 'Note', 'Location', 'State', 'Tags']) {
      expect(table.queryByRole('columnheader', { name })).toBeNull()
    }
    expect(within(row).queryByText('United Kingdom')).toBeNull()
    expect(within(row).getByText('Subscriber')).toBeInTheDocument()
  })

  it('has no Columns menu: every column is always shown', async () => {
    renderWithProviders(<CustomersPage />)
    await screen.findByText('Customer 2')

    expect(screen.queryByRole('button', { name: 'Columns' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument()

    const table = within(screen.getByRole('table'))
    const crmRow = table.getByText('Customer 1').closest('tr')!
    expect(within(crmRow).getByText('Administrator')).toBeInTheDocument()
    expect(table.getByRole('columnheader', { name: 'Last login' })).toBeInTheDocument()
  })

  it('falls back to first + last name, then the email, when there is no full name', async () => {
    renderWithProviders(<CustomersPage />)
    expect(await screen.findByText('Ian Rayner')).toBeInTheDocument()
  })

  it('queries the store picked in the top bar', async () => {
    const { store } = renderWithProviders(<CustomersPage />)
    await screen.findByText('Customer 2')
    expect(list.mock.calls.every(([params]) => !('shop' in params))).toBe(true)

    store.dispatch(shopSelected('polymer-uk'))

    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ shop: 'polymer-uk', page: 1 }),
      ),
    )
  })

  it('searches after a short pause, returns to page 1, and recovers from an empty result', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CustomersPage />)
    await screen.findByText('Customer 2')

    await user.type(
      screen.getByRole('searchbox', { name: 'Search customers' }),
      'nomatch',
    )

    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'nomatch', page: 1 }),
      ),
    )
    expect(await screen.findByText('No customers found')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear all filters' }))
    expect(await screen.findByText('Customer 2')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search customers' })).toHaveValue('')
  })

  it('filters by role, from the Customer role dropdown in the filters', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CustomersPage />)
    await screen.findByText('Customer 2')
    // There are no role tabs any more.
    expect(screen.queryByRole('group', { name: 'Filter by role' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Administrators/ })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.selectOptions(screen.getByLabelText('Customer role'), 'administrator')

    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'administrator', page_size: 25 }),
      ),
    )
    expect(screen.getByLabelText('Customer role')).toHaveValue('administrator')
  })

  it('starts with the filter grid collapsed and reveals it from the Filters button', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CustomersPage />)
    await screen.findByText('Customer 2')

    const toggle = screen.getByRole('button', { name: 'Filters' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('customer-filter-grid')).toHaveAttribute('inert')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('customer-filter-grid')).not.toHaveAttribute('inert')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('asks for every role on "All Customers", and for just one on the other choices', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CustomersPage />)
    await screen.findByText('Customer 2')
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ role: 'all', page: 1 }))
    // Never an un-roled request for the list itself (the API would default to subscribers).
    expect(list.mock.calls.filter(([params]) => params.role === undefined)).toHaveLength(
      0,
    )

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    const role = screen.getByLabelText('Customer role')
    await user.selectOptions(role, 'administrator')
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'administrator', page: 1, page_size: 25 }),
      ),
    )
    await user.selectOptions(role, 'subscriber')
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'subscriber', page: 1, page_size: 25 }),
      ),
    )
    // Back to "All Customers": shown at once from the cache.
    await user.selectOptions(role, '')
    expect(role).toHaveValue('')
  })

  it('has no Source filter', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CustomersPage />)
    await screen.findByText('Customer 2')
    await user.click(screen.getByRole('button', { name: 'Filters' }))

    expect(screen.queryByLabelText('Source')).not.toBeInTheDocument()
    expect(screen.queryByText('All Sources')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Account State')).toBeInTheDocument()
  })

  it('has no Tag, Min spent or Max spent filter', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CustomersPage />)
    await screen.findByText('Customer 2')
    await user.click(screen.getByRole('button', { name: 'Filters' }))

    expect(screen.queryByLabelText('Tag')).toBeNull()
    expect(screen.queryByLabelText('Min spent')).toBeNull()
    expect(screen.queryByLabelText('Max spent')).toBeNull()
    expect(
      ['Account State', 'Marketing', 'Orders', 'Sort by', 'Order'].every((name) =>
        screen.queryByLabelText(name),
      ),
    ).toBe(true)
  })

  it('sends state, marketing, orders and sort filters', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CustomersPage />)
    await screen.findByText('Customer 2')

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.selectOptions(screen.getByLabelText('Account State'), 'INVITED')
    await user.selectOptions(screen.getByLabelText('Marketing'), 'yes')
    await user.selectOptions(screen.getByLabelText('Orders'), 'no')
    await user.selectOptions(screen.getByLabelText('Sort by'), 'total_spent')
    await user.selectOptions(screen.getByLabelText('Order'), 'asc')

    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'INVITED',
          accepts_marketing: true,
          has_orders: false,
          sort: 'total_spent',
          order: 'asc',
          page: 1,
        }),
      ),
    )
  })

  it('offers countries seen so far and filters by them', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CustomersPage />)
    await screen.findByText('Customer 2')

    expect(
      within(screen.getByLabelText('Country:')).getByRole('option', {
        name: 'United Kingdom',
      }),
    ).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Country:'), 'United Kingdom')
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ country: 'United Kingdom', page: 1 }),
      ),
    )
  })

  it('shows the next page instantly (prefetched) and re-visits pages from cache', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CustomersPage />)
    await screen.findByText('Customer 2')

    // Page 2 is requested in the background without being asked for.
    await waitFor(() => expect(callsForPage(2)).toBe(1))
    const callsBefore = pageCalls().length

    await user.click(screen.getByRole('button', { name: 'Page 2' }))
    // No await/findBy: the rows are there in the same render as the click.
    expect(screen.getByText('Customer 26')).toBeInTheDocument()
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 26 to 50 of 60')

    await user.click(screen.getByRole('button', { name: 'Page 1' }))
    expect(screen.getByText('Customer 2')).toBeInTheDocument()

    // Page 1 was never fetched a second time; only page 3 was prefetched.
    expect(callsForPage(1)).toBe(1)
    expect(pageCalls().length - callsBefore).toBeLessThanOrEqual(1)
  })

  it('changes the page size', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CustomersPage />)
    await screen.findByText('Customer 2')

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
    renderWithProviders(<CustomersPage />)

    expect(await screen.findByText("Couldn't load customers")).toBeInTheDocument()
    expect(screen.getByText('Not logged in.')).toBeInTheDocument()

    failList = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Customer 2')).toBeInTheDocument()
  })

  it('shows a count on every role choice, honouring the other filters', async () => {
    list.mockImplementation((params) => {
      const byRole = { administrator: 7, subscriber: 53, all: 60 }
      const total = params.role ? byRole[params.role] : 53
      return Promise.resolve({ ...respond(params), total })
    })
    const user = userEvent.setup()
    renderWithProviders(<CustomersPage />)
    await screen.findByText('Customer 2')

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    const role = screen.getByLabelText('Customer role')
    expect(
      await within(role).findByRole('option', { name: 'All Customers (60)' }),
    ).toBeInTheDocument()
    expect(
      within(role).getByRole('option', { name: 'Administrators (7)' }),
    ).toBeInTheDocument()
    expect(
      within(role).getByRole('option', { name: 'Subscribers (53)' }),
    ).toBeInTheDocument()

    // The search narrows every choice's count (the count queries carry it).
    await user.type(screen.getByRole('searchbox', { name: 'Search customers' }), 'ian')
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'ian', role: 'administrator', page_size: 1 }),
      ),
    )
  })
})
