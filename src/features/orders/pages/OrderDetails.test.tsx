import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api/ApiError.ts'
import {
  api,
  type OrderDetail,
  type OrderListItem,
  type OrderListParams,
  type OrderListResponse,
} from '../../../lib/api/endpoints.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { OrdersPage } from './OrdersPage.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    orders: { list: vi.fn(), details: vi.fn() },
    products: {},
    customers: {},
    auth: {},
  },
}))

const SHOP = {
  key: 'polymer-uk',
  name: 'Packaging By Polymer',
  domain: 'polymer-uk-ltd.myshopify.com',
  currency: 'GBP',
}

function makeRow(n: number): OrderListItem {
  return {
    id: `order-${n}`,
    shopify_id: 14000000000000 + n,
    name: `#${17500 + n}`,
    order_number: 17500 + n,
    email: `buyer${n}@example.com`,
    customer: { id: null, full_name: null, email: null, phone: null, orders_count: null },
    shop: SHOP,
    currency: 'GBP',
    subtotal_price: '12.50',
    total_discounts: '0.00',
    total_shipping: '9.58',
    total_tax: '4.42',
    total_price: '26.50',
    total_refunded: '0.00',
    net_payment: '0.00',
    financial_status: 'AUTHORIZED',
    fulfillment_status: 'UNFULFILLED',
    return_status: 'NO_RETURN',
    payment_gateway_names: ['shopify_payments'],
    source_name: 'web',
    tags: ['Expected Delivery Day: Wednesday'],
    items_count: 1,
    line_items_preview: ['Pizza Box White Plain, Square [Alternative]'],
    shopify_created_at: '2026-10-22T07:48:51Z',
    shopify_updated_at: '2026-10-22T07:48:59Z',
    cancelled_at: null,
    closed_at: null,
  }
}

/** The order of the real answer: a guest checkout paid by card, one item, two shipping notes. */
function makeDetail(n: number): OrderDetail {
  return {
    ...makeRow(n),
    line_items_preview: [],
    contact_email: null,
    phone: null,
    presentment_currency: 'GBP',
    total_line_items_price: null,
    total_duties: null,
    total_tip: '0.00',
    total_outstanding: '0.00',
    current_total_price: '26.50',
    taxes_included: false,
    confirmed: true,
    test: false,
    note: 'Leave with the neighbour',
    note_attributes: [
      { key: 'landing_page', value: 'https://polymeruk.com/products/pizza-box' },
      { key: 'utm_source', value: 'google' },
      { key: 'odd_link', value: 'javascript:alert(1)' },
    ],
    po_number: null,
    cancel_reason: null,
    processed_at: '2026-10-22T07:48:46Z',
    billing_address: {
      kind: 'billing',
      first_name: 'jane',
      last_name: 'doe',
      name: 'jane doe',
      company: 'Example Co',
      address1: '1 Example Street',
      address2: null,
      city: 'Exampletown',
      province: 'England',
      province_code: 'ENG',
      country: 'United Kingdom',
      country_code: 'GB',
      zip: 'AB1 2CD',
      phone: '07700900123',
    },
    shipping_address: {
      kind: 'shipping',
      name: 'jane doe',
      company: 'Example Co',
      address1: '1 Example Street',
      city: 'Exampletown',
      province: 'England',
      country: 'United Kingdom',
      zip: 'AB1 2CD',
      phone: '07700900123',
    },
    line_items: [
      {
        id: 'li-1',
        shopify_id: 39269100978561,
        product_id: 'a499a9c7-72d1-4ab1-aa64-4f5ff282edaf',
        variant_id: 'c138ccae-1a20-4379-a203-4d4046ef5a67',
        title: 'Pizza Box White Plain, Square [Alternative]',
        variant_title: '14inch',
        sku: 'PB416E',
        vendor: 'Packaging By Polymer',
        image_url: 'https://cdn.shopify.com/s/files/pizza.jpg?v=1',
        quantity: 1,
        current_quantity: 1,
        fulfillable_quantity: 1,
        fulfillment_status: 'unfulfilled',
        price: '12.50',
        total_discount: '0.00',
        discounted_total: '12.50',
        original_total: '12.50',
        gift_card: false,
        taxable: true,
        requires_shipping: true,
      },
      {
        id: 'li-2',
        title: 'Hostile image',
        image_url: 'javascript:alert(1)',
        sku: null,
        quantity: 2,
        price: '1.00',
        discounted_total: '2.00',
        fulfillment_status: 'fulfilled',
      },
    ],
    transactions: [
      {
        id: 'tx-1',
        kind: 'AUTHORIZATION',
        status: 'SUCCESS',
        gateway: 'shopify_payments',
        amount: '26.50',
        currency: null,
        payment_method: 'CardPaymentDetails',
        card_brand: 'Mastercard',
        card_last4: '•••• •••• •••• 1906',
        card_wallet: null,
        error_code: null,
        message: null,
        processed_at: '2026-10-22T07:48:46Z',
        shopify_created_at: '2026-10-22T07:48:46Z',
      },
    ],
    refunds: [],
    fulfillments: [],
    discounts: [],
    events: [],
    shipping_lines: [
      {
        title: 'DPD Next Working Day Delivery - Orders Placed By 2pm',
        code: 'DPD_Next_Working_Day',
        source: 'Custom zip code base shipping',
        price: '9.58',
        discounted_price: '9.58',
      },
    ],
    tax_lines: [{ title: 'GB VAT', rate: '0.20000', price: '4.42' }],
    raw_json: null,
  }
}

function respond(params: OrderListParams): OrderListResponse {
  const pageSize = params.page_size ?? 25
  return {
    items: [1, 2, 3].map(makeRow).slice(0, pageSize),
    totals: {
      orders: 3,
      total_price: '79.50',
      total_refunded: '0.00',
      net_payment: '0.00',
    },
    page: 1,
    page_size: pageSize,
    total: 3,
    total_pages: 1,
    has_next: false,
    sort: 'created_at',
    order: 'desc',
  }
}

const list = vi.mocked(api.orders.list)
const details = vi.mocked(api.orders.details)

function Where() {
  const { pathname, search } = useLocation()
  return <p data-testid="where">{`${pathname}${search}`}</p>
}

function renderAt(route = '/orders') {
  return renderWithProviders(
    <>
      <Where />
      <Routes>
        <Route path="/orders/*" element={<OrdersPage />} />
      </Routes>
    </>,
    { route },
  )
}

const where = () => screen.getByTestId('where').textContent
const never = () => new Promise<never>(() => undefined)

describe('an order’s details page', () => {
  beforeEach(() => {
    list.mockImplementation((params) => Promise.resolve(respond(params)))
    details.mockImplementation((ref) => Promise.resolve(makeDetail(Number(ref) - 17500)))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  async function openFirst() {
    const user = userEvent.setup()
    renderAt()
    await screen.findByText('17501')
    await user.click(screen.getByRole('button', { name: 'View order 17501' }))
    return user
  }

  it('opens from the eye button, at /orders/<number> for the order’s store, and hides the list', async () => {
    await openFirst()

    expect(where()).toBe('/orders/17501?shop=polymer-uk')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Order #17501' }),
    ).toBeInTheDocument()
    expect(details).toHaveBeenCalledWith('17501', 'polymer-uk')
    // The list stays mounted but hidden.
    expect(screen.getByRole('table', { hidden: true }).closest('.hidden')).not.toBeNull()
  })

  it('draws its header from the list row at once, while the details are still loading', async () => {
    details.mockImplementation(never)
    await openFirst()

    // No wait: number, status and the facts come from the row already loaded.
    // (The list stays mounted behind the page, so look inside the page only.)
    const page = within(screen.getByRole('article'))
    expect(
      screen.getByRole('heading', { level: 1, name: 'Order #17501' }),
    ).toBeInTheDocument()
    expect(page.getByText('Open')).toBeInTheDocument()
    expect(page.getByTitle('Store')).toHaveTextContent('Packaging By Polymer')
    expect(page.getByTitle('Shopify ID')).toHaveTextContent('14000000000001')
    expect(page.getByTitle('Email')).toHaveTextContent('buyer1@example.com')
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    // The cards wait for the details: nothing of them is drawn yet.
    expect(page.queryByRole('heading', { name: 'Shipping address' })).toBeNull()
    expect(page.queryByRole('tab', { name: /^Items/ })).toBeNull()
  })

  it('has the details ready when the eye was hovered first: nothing to wait for', async () => {
    const user = userEvent.setup()
    renderAt()
    await screen.findByText('17502')
    await user.hover(screen.getByRole('button', { name: 'View order 17502' }))
    await waitFor(() => expect(details).toHaveBeenCalledWith('17502', 'polymer-uk'))
    await waitFor(() => expect(details).toHaveBeenCalledTimes(1))
    // Give the answer time to land in the cache.
    await new Promise((resolve) => setTimeout(resolve, 20))

    await user.click(screen.getByRole('button', { name: 'View order 17502' }))

    // The cards are there in the same render as the click.
    expect(screen.getByRole('heading', { name: 'Shipping address' })).toBeInTheDocument()
    expect(screen.queryByText('Loading…')).toBeNull()
    expect(details).toHaveBeenCalledTimes(1)
  })

  it('has the tabs: Overview, Items, Notes & Tracking', async () => {
    await openFirst()
    await screen.findByRole('heading', { name: 'Shipping address' })

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Overview',
      'Items3',
      'Notes & Tracking4',
    ])
  })

  it('shows the addresses, shipping method, fulfillments and tags on the Overview — and no customer, summary or payment card', async () => {
    await openFirst()
    await screen.findByRole('heading', { name: 'Shipping address' })

    const page = within(screen.getByRole('article'))
    for (const name of [
      'Shipping address',
      'Billing address',
      'Shipping method',
      'Fulfillments',
      'Tags',
    ]) {
      expect(page.getByRole('heading', { name })).toBeInTheDocument()
    }
    expect(page.queryByRole('heading', { name: 'Customer' })).toBeNull()
    expect(page.queryByText('Order Summary')).toBeNull()
    expect(page.queryByRole('heading', { name: 'Payment' })).toBeNull()
    expect(page.queryByRole('tab', { name: 'Shipping' })).toBeNull()

    expect(
      screen.getAllByText('Expected Delivery Day: Wednesday').length,
    ).toBeGreaterThan(0)

    // The note is only on Notes & Tracking.
    expect(page.queryByText('Leave with the neighbour')).toBeNull()
  })

  it('shows the shipping method: its name and ID, what was charged and how many items are still to ship', async () => {
    await openFirst()
    await screen.findByRole('heading', { name: 'Shipping address' })

    const method = within(
      screen.getByRole('heading', { name: 'Shipping method' }).closest('section')!,
    )
    expect(
      method.getByText('DPD Next Working Day Delivery - Orders Placed By 2pm'),
    ).toBeInTheDocument()
    expect(
      method.getByText('Custom zip code base shipping · DPD_Next_Working_Day'),
    ).toBeInTheDocument()
    expect(method.getByText('Shipping charged').closest('div')).toHaveTextContent('£9.58')
    // 1 + 2 items are unfulfilled lines' quantities still to ship.
    expect(method.getByText('Items to ship').closest('div')).toHaveTextContent('3')
    // The delivery status and the fulfillment count are not repeated in this card.
    expect(method.queryByText('Fulfillments')).toBeNull()
    expect(method.queryByText('Fulfillment status')).toBeNull()
  })

  it('names who the order is for in the header: the customer, and the company from the address', async () => {
    details.mockImplementation((ref) =>
      Promise.resolve({
        ...makeDetail(Number(ref) - 17500),
        customer: {
          id: 'cust-9',
          full_name: 'Jane Doe',
          email: 'jane@example.com',
          phone: null,
          orders_count: 3,
        },
      }),
    )
    await openFirst()
    await screen.findByRole('heading', { name: 'Shipping address' })
    const header = within(screen.getByRole('banner'))
    expect(header.getByTitle('Customer')).toHaveTextContent('Jane Doe · Example Co')
  })

  it('shows the shipping and billing addresses on the Overview, as two cards that fold, each on a few lines', async () => {
    await openFirst()
    await screen.findByRole('heading', { name: 'Shipping address' })

    const shipping = within(
      screen.getByRole('heading', { name: 'Shipping address' }).closest('section')!,
    )
    expect(shipping.getByText('jane doe')).toBeInTheDocument()
    expect(shipping.getByText('Example Co')).toBeInTheDocument()
    // The address on one line, as it would be said.
    expect(
      shipping.getByText(
        '1 Example Street, Exampletown, England, AB1 2CD, United Kingdom',
      ),
    ).toBeInTheDocument()
    expect(shipping.getByText('07700900123')).toBeInTheDocument()
    expect(
      shipping.getByRole('button', { name: 'Copy shipping address' }),
    ).toBeInTheDocument()

    // The fixture's billing address is the same place, and says so.
    const billing = within(
      screen.getByRole('heading', { name: 'Billing address' }).closest('section')!,
    )
    expect(
      billing.getByText(
        '1 Example Street, Exampletown, England, AB1 2CD, United Kingdom',
      ),
    ).toBeInTheDocument()
    expect(billing.getByText('Same as shipping')).toBeInTheDocument()
  })

  it('says so when an address is missing, and does not call two different ones the same', async () => {
    details.mockImplementation((ref) =>
      Promise.resolve({
        ...makeDetail(Number(ref) - 17500),
        shipping_address: null,
        billing_address: { name: 'Sam Roe', address1: '2 Other Road', country: 'France' },
      }),
    )
    await openFirst()
    await screen.findByRole('heading', { name: 'Shipping address' })

    expect(
      within(
        screen.getByRole('heading', { name: 'Shipping address' }).closest('section')!,
      ).getByText('No address.'),
    ).toBeInTheDocument()
    const billing = within(
      screen.getByRole('heading', { name: 'Billing address' }).closest('section')!,
    )
    expect(billing.getByText('2 Other Road, France')).toBeInTheDocument()
    expect(billing.queryByText('Same as shipping')).toBeNull()
  })

  it('lists the items on the Items tab, each linking to its product, with safe pictures only', async () => {
    const user = await openFirst()
    await screen.findByRole('heading', { name: 'Shipping address' })
    await user.click(screen.getByRole('tab', { name: /^Items/ }))

    const link = await screen.findByRole('link', {
      name: 'Pizza Box White Plain, Square [Alternative]',
    })
    expect(link).toHaveAttribute(
      'href',
      '/orders/product/a499a9c7-72d1-4ab1-aa64-4f5ff282edaf',
    )
    const row = link.closest('tr')!
    expect(within(row).getByText('14inch · PB416E')).toBeInTheDocument()
    const picture = row.querySelector('img')!
    expect(picture).toHaveAttribute(
      'src',
      'https://cdn.shopify.com/s/files/pizza.jpg?v=1',
    )
    expect(picture).toHaveAttribute('referrerpolicy', 'no-referrer')

    // A picture address that is not http(s) is never used.
    const hostile = screen.getByText('Hostile image').closest('tr')!
    expect(hostile.querySelector('img')).toBeNull()
  })

  it('ends the Items table with the order’s totals', async () => {
    const user = await openFirst()
    await screen.findByRole('heading', { name: 'Shipping address' })
    await user.click(screen.getByRole('tab', { name: /^Items/ }))

    const page = within(screen.getByRole('article'))
    expect(await page.findByRole('heading', { name: 'Order Items' })).toBeInTheDocument()
    const table = within(await page.findByRole('table'))
    expect(
      table.getAllByRole('columnheader').map((header) => header.textContent),
    ).toEqual(['Product', 'Price', 'Quantity', 'Total price'])
    // The totals under the lines: subtotal, shipping, tax, then the total.
    expect(page.getAllByText('Total price')).toHaveLength(2)
    const rowOf = (label: string) => page.getByText(label).closest('div')!
    expect(rowOf('Subtotal')).toHaveTextContent('£12.50')
    expect(rowOf('Shipping')).toHaveTextContent('£9.58')
    expect(rowOf('Tax')).toHaveTextContent('£4.42')
    expect(page.getAllByText('£26.50').length).toBeGreaterThan(0)
  })

  it('shows the order’s status, date, customer, store, email and Shopify ID in the header', async () => {
    await openFirst()
    await screen.findByRole('heading', { name: 'Shipping address' })
    const header = within(screen.getByRole('banner'))

    // Not paid-and-fulfilled yet: the order is still open.
    expect(header.getByText('Open')).toBeInTheDocument()
    expect(header.getByTitle('Order date')).toHaveTextContent(/22 Oct 2026/)
    expect(header.getByTitle('Store')).toHaveTextContent('Packaging By Polymer')
    expect(header.getByTitle('Email')).toHaveTextContent('buyer1@example.com')
    expect(header.getByRole('button', { name: 'Copy email' })).toBeInTheDocument()
    expect(header.getByTitle('Shopify ID')).toHaveTextContent('14000000000001')
    expect(header.getByRole('button', { name: 'Copy Shopify ID' })).toBeInTheDocument()
    // The summary cards of an earlier design are not in the header.
    expect(header.queryByText('Payment status')).toBeNull()
    expect(header.queryByText('Fulfillment status')).toBeNull()
  })

  it('says so when nothing has been fulfilled yet', async () => {
    await openFirst()
    await screen.findByRole('heading', { name: 'Shipping address' })

    const fulfillments = within(
      screen.getByRole('heading', { name: 'Fulfillments' }).closest('section')!,
    )
    expect(fulfillments.getByText('Nothing has been fulfilled yet.')).toBeInTheDocument()
  })

  it('shows each fulfillment in the Fulfillments card: id, status, tracking, date, service', async () => {
    details.mockImplementation((ref) =>
      Promise.resolve({
        ...makeDetail(Number(ref) - 17500),
        fulfillments: [
          {
            id: 'ful-1',
            shopify_id: 99,
            order_id: 'x',
            name: '#17501.1',
            status: 'success',
            created_at: '2026-10-23T09:00:00Z',
            service: 'manual',
            tracking_number: '15501234567890',
            tracking_url: 'https://track.example/1',
            line_items: [{ id: 'a' }, { id: 'b' }],
          },
        ],
      }),
    )
    await openFirst()
    await screen.findByRole('heading', { name: 'Shipping address' })

    // The fulfillment: its name and status, the tracking number (with a copy button) and link,
    // the date as a date, the service and the other readable details — no ids.
    const fulfillment = within(screen.getByText('#17501.1').closest('li')!)
    expect(fulfillment.getByText('Success')).toBeInTheDocument()
    expect(fulfillment.getByText('15501234567890')).toBeInTheDocument()
    expect(
      fulfillment.getByRole('button', { name: 'Copy tracking number' }),
    ).toBeInTheDocument()
    expect(
      fulfillment.getByRole('link', { name: 'https://track.example/1' }),
    ).toHaveAttribute('rel', 'noopener noreferrer')
    const date = fulfillment.getByText('Fulfillment date').closest('div')!
    expect(date).toHaveTextContent(/2026/)
    expect(date).not.toHaveTextContent('2026-10-23T')
    expect(fulfillment.getByText('Items').closest('div')).toHaveTextContent('2')
    expect(fulfillment.getByText('Service').closest('div')).toHaveTextContent('Manual')
    expect(screen.queryByText('Order id')).toBeNull()
    expect(screen.queryByText('Shopify id')).toBeNull()
  })

  it('links the customer’s name in the header to their page, and shows the order’s email', async () => {
    details.mockImplementation((ref) =>
      Promise.resolve({
        ...makeDetail(Number(ref) - 17500),
        email: 'Jane@Example.com',
        customer: {
          id: 'cust-9',
          full_name: 'Jane Doe',
          email: 'jane@example.com',
          phone: null,
          orders_count: 3,
        },
      }),
    )
    await openFirst()
    await screen.findByRole('heading', { name: 'Shipping address' })

    const header = within(screen.getByRole('banner'))
    expect(header.getByRole('link', { name: 'Jane Doe' })).toHaveAttribute(
      'href',
      '/orders/customer/cust-9',
    )
    expect(header.getByTitle('Email')).toHaveTextContent('Jane@Example.com')
  })

  it('lists the notes and tracking, with only http(s) values as links', async () => {
    const user = await openFirst()
    await screen.findByRole('heading', { name: 'Shipping address' })
    await user.click(screen.getByRole('tab', { name: /^Notes & Tracking/ }))

    // The order's note, then (none yet) the tracking, then the other details saved with it.
    expect(screen.getByRole('heading', { name: 'Order note' })).toBeInTheDocument()
    expect(screen.getByText('Leave with the neighbour')).toBeInTheDocument()
    expect(screen.getByText('No tracking details yet.')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Additional details' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Landing page')).toBeInTheDocument()

    const link = screen.getByRole('link', {
      name: 'https://polymeruk.com/products/pizza-box',
    })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText('google')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /javascript/ })).toBeNull()
    expect(screen.getByText('javascript:alert(1)')).toBeInTheDocument()
  })

  it('shows each parcel’s tracking — from the fulfillments and a tracking detail — with a safe link', async () => {
    details.mockImplementation((ref) =>
      Promise.resolve({
        ...makeDetail(Number(ref) - 17500),
        note: null,
        fulfillments: [
          {
            name: '#17501.1',
            tracking_company: 'DPD',
            tracking_number: '15501234567890',
            tracking_url: 'https://track.dpd.co.uk/parcels/15501234567890',
          },
          {
            name: '#17501.2',
            tracking_number: 'BAD1',
            tracking_url: 'javascript:alert(1)',
          },
        ],
        note_attributes: [{ key: 'tracking_number', value: 'ABC-123' }],
      }),
    )
    const user = await openFirst()
    await screen.findByRole('heading', { name: 'Shipping address' })
    await user.click(screen.getByRole('tab', { name: /^Notes & Tracking/ }))

    expect(screen.getByText('No note on this order.')).toBeInTheDocument()
    expect(screen.getByText('DPD')).toBeInTheDocument()
    expect(screen.getByText('15501234567890')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Copy tracking number' })).toHaveLength(
      3,
    )
    const track = screen.getAllByRole('link', {
      name: 'https://track.dpd.co.uk/parcels/15501234567890',
    })
    expect(track).toHaveLength(1)
    expect(track[0]).toHaveAttribute(
      'href',
      'https://track.dpd.co.uk/parcels/15501234567890',
    )
    expect(track[0]).toHaveAttribute('rel', 'noopener noreferrer')
    // A hostile address is no link at all.
    expect(screen.queryByRole('link', { name: /javascript/ })).toBeNull()
    // A hostile address is never a link, but its number still shows.
    expect(screen.getByText('BAD1')).toBeInTheDocument()
    // The tracking detail saved with the order is a tracking card, not an "additional" one.
    expect(screen.getByText('ABC-123')).toBeInTheDocument()
    expect(
      screen.getByText('Nothing else was saved with this order.'),
    ).toBeInTheDocument()
  })

  it('goes back to the list, which kept its page and filters', async () => {
    const user = await openFirst()
    await screen.findByRole('heading', { name: 'Shipping address' })

    await user.click(screen.getByRole('button', { name: 'Back to list' }))

    expect(where()).toBe('/orders')
    expect(screen.getByRole('table').closest('.hidden')).toBeNull()
    expect(screen.queryByRole('heading', { level: 1, name: 'Order #17501' })).toBeNull()
  })

  it('opens straight from the address, for any order, with a placeholder until it arrives', async () => {
    let finish: (order: OrderDetail) => void = () => undefined
    details.mockImplementation(
      () => new Promise<OrderDetail>((resolve) => (finish = resolve)),
    )
    renderAt('/orders/17516?shop=polymer-uk')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Order #17516' }),
    ).toBeInTheDocument()
    expect(details).toHaveBeenCalledWith('17516', 'polymer-uk')
    expect(screen.queryByRole('heading', { name: 'Shipping address' })).toBeNull()

    finish({ ...makeDetail(1), order_number: 17516, name: '#17516' })
    expect(
      await screen.findByRole('heading', { name: 'Shipping address' }),
    ).toBeInTheDocument()
  })

  it('shows the backend’s message when the order cannot be read, and recovers on retry', async () => {
    details.mockRejectedValueOnce(new ApiError('Order not found.', { status: 404 }))
    const user = userEvent.setup()
    renderAt('/orders/99999')

    expect(await screen.findByText("Couldn't load this order")).toBeInTheDocument()
    expect(screen.getByText('Order not found.')).toBeInTheDocument()

    details.mockResolvedValue({ ...makeDetail(1), order_number: 99999, name: '#99999' })
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByRole('heading', { name: 'Shipping address' }),
    ).toBeInTheDocument()
  })

  describe('the strip of opened orders (like the products’ tabs)', () => {
    const strip = () => screen.getByRole('navigation', { name: 'Open orders' })

    it('is not there until an order is opened', async () => {
      renderAt()
      await screen.findByText('17501')

      expect(screen.queryByRole('navigation', { name: 'Open orders' })).toBeNull()
    })

    it('shows "All Orders" and a tab for the opened order, with the order’s tab active', async () => {
      await openFirst()
      await screen.findByRole('heading', { name: 'Shipping address' })

      expect(within(strip()).getByRole('button', { name: 'All Orders' })).toBeVisible()
      const tab = within(strip()).getByRole('button', { name: /^Order\s*17501$/ })
      expect(tab).toHaveAttribute('aria-current', 'page')
      expect(within(strip()).getByRole('button', { name: 'Close 17501' })).toBeVisible()
    })

    it('returns to the list from "All Orders" and back to the order from its tab', async () => {
      const user = await openFirst()
      await screen.findByRole('heading', { name: 'Shipping address' })

      await user.click(within(strip()).getByRole('button', { name: 'All Orders' }))
      expect(where()).toBe('/orders')
      expect(screen.getByRole('table')).toBeVisible()
      // The tab stays, now not the current one.
      const tab = within(strip()).getByRole('button', { name: /^Order\s*17501$/ })
      expect(tab).not.toHaveAttribute('aria-current')

      await user.click(tab)
      expect(where()).toBe('/orders/17501?shop=polymer-uk')
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Order #17501' }),
      ).toBeInTheDocument()
    })

    it('keeps every order opened this way as its own tab, and switches between them', async () => {
      const user = await openFirst()
      await screen.findByRole('heading', { name: 'Shipping address' })
      await user.click(within(strip()).getByRole('button', { name: 'All Orders' }))
      await user.click(screen.getByRole('button', { name: 'View order 17502' }))
      await screen.findByRole('heading', { level: 1, name: 'Order #17502' })

      expect(
        within(strip()).getByRole('button', { name: /^Order\s*17501$/ }),
      ).toBeInTheDocument()
      expect(
        within(strip()).getByRole('button', { name: /^Order\s*17502$/ }),
      ).toHaveAttribute('aria-current', 'page')

      await user.click(within(strip()).getByRole('button', { name: /^Order\s*17501$/ }))
      expect(where()).toBe('/orders/17501?shop=polymer-uk')
    })

    it('closes a tab; closing the one you are on moves to its neighbour, then to the list', async () => {
      const user = await openFirst()
      await screen.findByRole('heading', { name: 'Shipping address' })
      await user.click(within(strip()).getByRole('button', { name: 'All Orders' }))
      await user.click(screen.getByRole('button', { name: 'View order 17502' }))
      await screen.findByRole('heading', { level: 1, name: 'Order #17502' })

      // On 17502 (the last tab): closing it lands on 17501.
      await user.click(within(strip()).getByRole('button', { name: 'Close 17502' }))
      expect(where()).toBe('/orders/17501?shop=polymer-uk')
      expect(within(strip()).queryByRole('button', { name: /17502/ })).toBeNull()

      // Closing the only one left returns to the list and the strip disappears.
      await user.click(within(strip()).getByRole('button', { name: 'Close 17501' }))
      expect(where()).toBe('/orders')
      expect(screen.queryByRole('navigation', { name: 'Open orders' })).toBeNull()
    })

    it('closes them all with Clear and goes back to the list', async () => {
      const user = await openFirst()
      await screen.findByRole('heading', { name: 'Shipping address' })

      await user.click(within(strip()).getByRole('button', { name: 'Clear' }))

      expect(where()).toBe('/orders')
      expect(screen.queryByRole('navigation', { name: 'Open orders' })).toBeNull()
    })

    it('gives an order opened from a bare address a tab too, labelled with its number', async () => {
      renderAt('/orders/17503?shop=polymer-uk')
      await screen.findByRole('heading', { name: 'Shipping address' })

      expect(
        within(strip()).getByRole('button', { name: /^Order\s*17503$/ }),
      ).toHaveAttribute('aria-current', 'page')
    })
  })

  it('never asks for the raw Shopify payload', async () => {
    await openFirst()
    await screen.findByRole('heading', { name: 'Shipping address' })

    expect(screen.queryByRole('tab', { name: /raw/i })).toBeNull()
    // The call carries only the number and the store (include_raw=false is added by the API layer).
    for (const call of details.mock.calls) expect(call).toHaveLength(2)
  })
})
