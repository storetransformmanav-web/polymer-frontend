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
const callsForPage = (page: number) =>
  list.mock.calls.filter(([params]) => params.page === page).length

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
    expect(list).toHaveBeenCalledWith({
      sort: 'created_at',
      order: 'desc',
      page: 1,
      page_size: 25,
    })
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 1 to 25 of 60 entries')
    expect(screen.getByText('customer2@example.com')).toBeInTheDocument()
  })

  it('shows each customer’s role, account state, spend and marketing status', async () => {
    renderWithProviders(<CustomersPage />)
    await screen.findByText('Customer 2')

    const table = within(screen.getByRole('table'))
    // #1: a CRM-created administrator (no Shopify state, no currency, no marketing flag).
    const crmRow = table.getByText('Customer 1').closest('tr')!
    expect(within(crmRow).getByText('Administrator')).toBeInTheDocument()
    expect(within(crmRow).getByText('CRM')).toBeInTheDocument()
    // #2: Shopify subscriber with money spent and a marketing opt-in.
    const row = table.getByText('Customer 2').closest('tr')!
    expect(within(row).getByText('Subscriber')).toBeInTheDocument()
    expect(within(row).getByText('Enabled')).toBeInTheDocument()
    expect(within(row).getByText('£45.70')).toBeInTheDocument()
    expect(within(row).getByText('Subscribed')).toBeInTheDocument()
    expect(within(row).getByText('+1')).toBeInTheDocument() // 3 tags: two shown, +1
    // #5 is invited.
    expect(
      within(table.getByText('Customer 5').closest('tr')!).getByText('Invited'),
    ).toBeInTheDocument()
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

  it('filters by role tab', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CustomersPage />)
    await screen.findByText('Customer 2')

    await user.click(screen.getByRole('button', { name: 'Administrators' }))

    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'administrator' }),
      ),
    )
    expect(screen.getByRole('button', { name: /^Administrators/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('sends source, state, marketing, orders, sort and spend filters', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CustomersPage />)
    await screen.findByText('Customer 2')

    await user.selectOptions(screen.getByLabelText('Source'), 'crm')
    await user.selectOptions(screen.getByLabelText('Account State'), 'INVITED')
    await user.selectOptions(screen.getByLabelText('Marketing'), 'yes')
    await user.selectOptions(screen.getByLabelText('Orders'), 'no')
    await user.selectOptions(screen.getByLabelText('Sort by'), 'total_spent')
    await user.selectOptions(screen.getByLabelText('Order'), 'asc')
    await user.type(screen.getByLabelText('Min spent'), '10')

    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'crm',
          state: 'INVITED',
          accepts_marketing: true,
          has_orders: false,
          sort: 'total_spent',
          order: 'asc',
          min_spent: 10,
          page: 1,
        }),
      ),
    )
  })

  it('offers countries and tags seen so far and filters by them', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CustomersPage />)
    await screen.findByText('Customer 2')

    expect(
      within(screen.getByLabelText('Country:')).getByRole('option', {
        name: 'United Kingdom',
      }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByLabelText('Tag')).getByRole('option', { name: 'VIP' }),
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
    const callsBefore = list.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Page 2' }))
    // No await/findBy: the rows are there in the same render as the click.
    expect(screen.getByText('Customer 26')).toBeInTheDocument()
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 26 to 50 of 60')

    await user.click(screen.getByRole('button', { name: 'Page 1' }))
    expect(screen.getByText('Customer 2')).toBeInTheDocument()

    // Page 1 was never fetched a second time; only page 3 was prefetched.
    expect(callsForPage(1)).toBe(1)
    expect(list.mock.calls.length - callsBefore).toBeLessThanOrEqual(1)
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
    list.mockRejectedValueOnce(new ApiError('Not logged in.', { status: 401 }))
    const user = userEvent.setup()
    renderWithProviders(<CustomersPage />)

    expect(await screen.findByText("Couldn't load customers")).toBeInTheDocument()
    expect(screen.getByText('Not logged in.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Customer 2')).toBeInTheDocument()
  })
})
