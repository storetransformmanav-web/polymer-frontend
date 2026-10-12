import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api/ApiError.ts'
import {
  api,
  type CustomerDetail,
  type CustomerListItem,
  type CustomerListParams,
  type CustomerListResponse,
} from '../../../lib/api/endpoints.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { CustomersPage } from './CustomersPage.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: { customers: { list: vi.fn(), details: vi.fn() }, products: {}, auth: {} },
}))

/** Customer N: #1 is a CRM administrator, the rest are Shopify subscribers. */
function makeListItem(n: number): CustomerListItem {
  const crm = n === 1
  return {
    id: `cust-${n}`,
    shopify_id: crm ? null : 1000 + n,
    email: `customer${n}@example.com`,
    full_name: `Customer ${n}`,
    first_name: null,
    last_name: null,
    phone: null,
    role: crm ? 'administrator' : 'subscriber',
    is_active: true,
    shopify_state: crm ? null : 'ENABLED',
    accepts_marketing: crm ? null : true,
    orders_count: crm ? 0 : 2,
    total_spent: crm ? '0.00' : '45.70',
    currency: crm ? null : 'GBP',
    tags: [],
    city: null,
    country: 'United Kingdom',
    last_order_name: crm ? null : '#17181',
    shopify_created_at: crm ? null : '2026-10-08T12:55:03Z',
    last_login_at: null,
  }
}

function respond(params: CustomerListParams): CustomerListResponse {
  const pageSize = params.page_size ?? 20
  return {
    items: Array.from({ length: Math.min(pageSize, 5) }, (_, i) => makeListItem(i + 1)),
    page: 1,
    page_size: pageSize,
    total: 5,
    total_pages: 1,
    has_next: false,
    sort: 'created_at',
    order: 'desc',
  }
}

/** Details for customer `cust-N`, shaped like the real API's response. */
function makeDetail(id: string, raw = false): CustomerDetail {
  const n = Number(id.replace('cust-', ''))
  const crm = n === 1
  return {
    ...makeListItem(n),
    id,
    shopify_gid: crm ? null : `gid://shopify/Customer/${1000 + n}`,
    phone: '+44 20 7946 0000',
    verified_email: true,
    email_marketing_state: 'SUBSCRIBED',
    email_marketing_opt_in_level: 'SINGLE_OPT_IN',
    email_marketing_updated_at: '2026-10-08T12:55:03Z',
    sms_marketing_state: 'NOT_SUBSCRIBED',
    sms_marketing_opt_in_level: null,
    sms_marketing_updated_at: null,
    tax_exempt: false,
    tax_exemptions: [],
    tax_id: 'GB123456789',
    tags: ['Login with Shop', 'VIP'],
    note: 'Prefers morning deliveries\nCall ahead',
    locale: 'en-GB',
    rfm_group: 'LOYAL',
    predicted_spend_tier: 'HIGH',
    data_sale_opt_out: false,
    created_at: '2026-10-09T11:44:39Z',
    updated_at: '2026-10-09T11:44:39Z',
    addresses: crm
      ? []
      : [
          {
            id: 'addr-1',
            is_default: true,
            name: 'Ian Rayner',
            company: 'Rayner Bakery',
            address1: '12 High Street',
            address2: null,
            city: 'Winchester',
            province: 'Hampshire',
            zip: 'SO23 9AA',
            country: 'United Kingdom',
          },
        ],
    metafields: [],
    raw_json: raw ? { id: `gid://shopify/Customer/${1000 + n}`, note: 'RAW-NOTE' } : null,
  }
}

const list = vi.mocked(api.customers.list)
const details = vi.mocked(api.customers.details)

function Path() {
  return <p data-testid="path">{useLocation().pathname}</p>
}

function renderPage(route = '/customers') {
  return renderWithProviders(
    <>
      <Path />
      <Routes>
        <Route path="/customers/*" element={<CustomersPage />} />
      </Routes>
    </>,
    { route },
  )
}

describe('Customer details', () => {
  beforeEach(() => {
    list.mockImplementation((params) => Promise.resolve(respond(params)))
    details.mockImplementation((id, raw) => Promise.resolve(makeDetail(id, raw)))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('opens a customer on the same page from the View button', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Customer 2')

    await user.click(screen.getByRole('button', { name: 'View Customer 2' }))

    expect(screen.getByTestId('path')).toHaveTextContent('/customers/cust-2')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Customer 2' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(details).toHaveBeenCalledWith('cust-2', false) // raw payload not requested up front
  })

  it('does not open details when a row is clicked anywhere but the View button', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Customer 3')

    await user.click(screen.getByText('Customer 3'))

    expect(screen.getByTestId('path')).toHaveTextContent(/^\/customers$/)
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it('draws the header and summary at once from the list row while details load', async () => {
    details.mockReturnValue(new Promise(() => undefined)) // never answers
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Customer 2')

    await user.click(screen.getByRole('button', { name: 'View Customer 4' }))

    expect(
      screen.getByRole('heading', { level: 1, name: 'Customer 4' }),
    ).toBeInTheDocument()
    // (The list stays mounted but hidden, so look inside the details article.)
    const article = within(screen.getByRole('article'))
    expect(article.getByText('customer4@example.com')).toBeInTheDocument()
    expect(article.getByText('£45.70')).toBeInTheDocument() // total spent, from the list row
    expect(article.getByText('Last order #17181')).toBeInTheDocument()
  })

  it('prefetches details on hover so opening needs no extra request', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Customer 2')

    await user.hover(screen.getByRole('button', { name: 'View Customer 2' }))
    await waitFor(() => expect(details).toHaveBeenCalledWith('cust-2', false))
    const callsAfterHover = details.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'View Customer 2' }))

    // The full record is on screen immediately (cached), with no second request.
    expect(screen.getByText('Contact & Account')).toBeInTheDocument()
    expect(details.mock.calls.length).toBe(callsAfterHover)
  })

  it('renders the overview from the API data', async () => {
    renderPage('/customers/cust-7')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Customer 7' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('Contact & Account')).toBeInTheDocument()
    expect(screen.getByText('+44 20 7946 0000')).toBeInTheDocument()
    expect(screen.getByText('en-GB')).toBeInTheDocument()
    expect(screen.getByText('Loyal')).toBeInTheDocument() // RFM group, humanised
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('VIP')).toBeInTheDocument() // tag chip
    expect(screen.getByText(/Prefers morning deliveries/)).toBeInTheDocument()
  })

  it('shows addresses, marketing & tax, and an empty state when there are no addresses', async () => {
    const user = userEvent.setup()
    renderPage('/customers/cust-7')
    await screen.findByText('Contact & Account')

    await user.click(screen.getByRole('tab', { name: /Addresses/ }))
    expect(screen.getByText('12 High Street')).toBeInTheDocument()
    expect(screen.getByText('Winchester, Hampshire')).toBeInTheDocument()
    expect(screen.getByText('SO23 9AA United Kingdom')).toBeInTheDocument()
    expect(screen.getByText('Default')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Marketing & Tax' }))
    expect(screen.getByText('Single opt in')).toBeInTheDocument()
    expect(screen.getByText('GB123456789')).toBeInTheDocument()
  })

  it('says so when a CRM customer has no saved addresses', async () => {
    const user = userEvent.setup()
    renderPage('/customers/cust-1')
    await screen.findByText('Contact & Account')

    await user.click(screen.getByRole('tab', { name: /Addresses/ }))
    expect(screen.getByText('No saved addresses.')).toBeInTheDocument()
  })

  it('loads the raw Shopify data only when its tab is opened', async () => {
    const user = userEvent.setup()
    renderPage('/customers/cust-7')
    await screen.findByText('Contact & Account')
    expect(details).not.toHaveBeenCalledWith('cust-7', true)

    await user.click(screen.getByRole('tab', { name: 'Raw data' }))

    expect(await screen.findByText(/RAW-NOTE/)).toBeInTheDocument()
    expect(details).toHaveBeenCalledWith('cust-7', true)
  })

  it('shows the backend message when a customer cannot be loaded, and goes back', async () => {
    details.mockRejectedValue(new ApiError('Customer not found.', { status: 404 }))
    const user = userEvent.setup()
    renderPage('/customers/cust-404')

    expect(await screen.findByText("Couldn't load this customer")).toBeInTheDocument()
    expect(screen.getByText('Customer not found.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to list' }))
    expect(screen.getByTestId('path')).toHaveTextContent(/^\/customers$/)
  })

  it('goes back to the list and reopens the customer from cache without a request', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Customer 2')

    await user.click(screen.getByRole('button', { name: 'View Customer 5' }))
    await screen.findByText('Contact & Account')
    await user.click(screen.getByRole('button', { name: 'Back to list' }))
    expect(screen.getByTestId('path')).toHaveTextContent(/^\/customers$/)

    const calls = details.mock.calls.length
    const rows = within(screen.getByRole('table'))
    await user.click(rows.getByRole('button', { name: 'View Customer 5' }))

    expect(screen.getByText('Contact & Account')).toBeInTheDocument()
    expect(details.mock.calls.length).toBe(calls)
  })
})
