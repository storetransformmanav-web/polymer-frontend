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
      await screen.findByRole('heading', { level: 1, name: 'Order 17501' }),
    ).toBeInTheDocument()
    expect(details).toHaveBeenCalledWith('17501', 'polymer-uk')
    // The list stays mounted but hidden.
    expect(screen.getByRole('table', { hidden: true }).closest('.hidden')).not.toBeNull()
  })

  it('draws its header from the list row at once, while the details are still loading', async () => {
    details.mockImplementation(never)
    await openFirst()

    // No wait: number, payment, fulfillment, total and store come from the row already loaded.
    expect(
      screen.getByRole('heading', { level: 1, name: 'Order 17501' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Authorized').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Unfulfilled').length).toBeGreaterThan(0)
    expect(screen.getAllByText('£26.50').length).toBeGreaterThan(0)
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    // The summary figures are there, the rest is a placeholder.
    expect(screen.getByText('Total price', { selector: 'p' })).toBeInTheDocument()
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
    expect(screen.getByText('Order Summary')).toBeInTheDocument()
    expect(screen.queryByText('Loading…')).toBeNull()
    expect(details).toHaveBeenCalledTimes(1)
  })

  it('has the tabs of a product page: Overview, Items, Payments, Shipping, Notes & Tracking', async () => {
    await openFirst()
    await screen.findByText('Order Summary')

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Overview',
      'Items2',
      'Payments1',
      'Shipping',
      'Notes & Tracking3',
    ])
  })

  it('shows the order’s money, customer, status and store in cards on the Overview', async () => {
    await openFirst()
    await screen.findByText('Order Summary')

    const summary = within(screen.getByText('Order Summary').closest('section')!)
    expect(summary.getByText('£12.50')).toBeInTheDocument() // subtotal
    expect(summary.getByText('£9.58')).toBeInTheDocument() // shipping
    expect(summary.getByText('£4.42')).toBeInTheDocument() // tax
    expect(summary.getByText('£26.50')).toBeInTheDocument() // total

    // The customer card: a guest checkout has no customer name or email, but the order's
    // own email is there, labelled as such.
    const customer = within(
      screen.getByRole('heading', { name: 'Customer' }).closest('section')!,
    )
    expect(customer.getByText('Order email')).toBeInTheDocument()
    expect(customer.getByText('buyer1@example.com')).toBeInTheDocument()
    const name = customer.getByText('Name').closest('div')!
    expect(name).toHaveTextContent('—')

    expect(screen.getByText('Leave with the neighbour')).toBeInTheDocument()
    expect(
      screen.getAllByText('Expected Delivery Day: Wednesday').length,
    ).toBeGreaterThan(0)
  })

  it('lists the items on the Items tab, each linking to its product, with safe pictures only', async () => {
    const user = await openFirst()
    await screen.findByText('Order Summary')
    await user.click(screen.getByRole('tab', { name: /^Items/ }))

    const link = screen.getByRole('link', {
      name: 'Pizza Box White Plain, Square [Alternative]',
    })
    expect(link).toHaveAttribute('href', '/products/a499a9c7-72d1-4ab1-aa64-4f5ff282edaf')
    const row = link.closest('tr')!
    expect(within(row).getByText('PB416E')).toBeInTheDocument()
    expect(within(row).getByText('14inch')).toBeInTheDocument()
    expect(within(row).getByText('Unfulfilled')).toBeInTheDocument()
    const picture = row.querySelector('img')!
    expect(picture).toHaveAttribute(
      'src',
      'https://cdn.shopify.com/s/files/pizza.jpg?v=1',
    )
    expect(picture).toHaveAttribute('referrerpolicy', 'no-referrer')

    // A picture address that is not http(s) is never used.
    const hostile = screen.getByText('Hostile image').closest('tr')!
    expect(hostile.querySelector('img')).toBeNull()
    expect(within(hostile).getByText('Fulfilled')).toBeInTheDocument()
  })

  it('shows the payments: the card transaction, no refunds, and the tax', async () => {
    const user = await openFirst()
    await screen.findByText('Order Summary')
    await user.click(screen.getByRole('tab', { name: /^Payments/ }))

    const row = screen.getByText('Authorization').closest('tr')!
    expect(within(row).getByText('Success')).toBeInTheDocument()
    expect(within(row).getByText('shopify_payments')).toBeInTheDocument()
    expect(within(row).getByText('Mastercard •••• •••• •••• 1906')).toBeInTheDocument()
    expect(within(row).getByText('£26.50')).toBeInTheDocument()
    expect(screen.getByText('Nothing has been refunded.')).toBeInTheDocument()
    expect(screen.getByText('GB VAT')).toBeInTheDocument()
    expect(screen.getByText('(20%)')).toBeInTheDocument()
  })

  it('shows the shipping: both addresses, the method and what was fulfilled', async () => {
    const user = await openFirst()
    await screen.findByText('Order Summary')
    await user.click(screen.getByRole('tab', { name: 'Shipping' }))

    const shipping = within(screen.getByText('Shipping address').closest('section')!)
    expect(shipping.getByText('jane doe')).toBeInTheDocument()
    expect(shipping.getByText('1 Example Street')).toBeInTheDocument()
    expect(shipping.getByText('Exampletown AB1 2CD')).toBeInTheDocument()
    expect(shipping.getByText('United Kingdom')).toBeInTheDocument()
    expect(screen.getByText('Billing address')).toBeInTheDocument()
    expect(
      screen.getByText('DPD Next Working Day Delivery - Orders Placed By 2pm'),
    ).toBeInTheDocument()
    expect(screen.getByText('Nothing has been fulfilled yet.')).toBeInTheDocument()
  })

  it('lists the notes and tracking, with only http(s) values as links', async () => {
    const user = await openFirst()
    await screen.findByText('Order Summary')
    await user.click(screen.getByRole('tab', { name: /^Notes & Tracking/ }))

    const link = screen.getByRole('link', {
      name: 'https://polymeruk.com/products/pizza-box',
    })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText('google')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /javascript/ })).toBeNull()
    expect(screen.getByText('javascript:alert(1)')).toBeInTheDocument()
  })

  it('goes back to the list, which kept its page and filters', async () => {
    const user = await openFirst()
    await screen.findByText('Order Summary')

    await user.click(screen.getByRole('button', { name: 'Back to list' }))

    expect(where()).toBe('/orders')
    expect(screen.getByRole('table').closest('.hidden')).toBeNull()
    expect(screen.queryByRole('heading', { level: 1, name: 'Order 17501' })).toBeNull()
  })

  it('opens straight from the address, for any order, with a placeholder until it arrives', async () => {
    let finish: (order: OrderDetail) => void = () => undefined
    details.mockImplementation(
      () => new Promise<OrderDetail>((resolve) => (finish = resolve)),
    )
    renderAt('/orders/17516?shop=polymer-uk')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Order 17516' }),
    ).toBeInTheDocument()
    expect(details).toHaveBeenCalledWith('17516', 'polymer-uk')
    expect(screen.queryByText('Order Summary')).toBeNull()

    finish({ ...makeDetail(1), order_number: 17516, name: '#17516' })
    expect(await screen.findByText('Order Summary')).toBeInTheDocument()
  })

  it('shows the backend’s message when the order cannot be read, and recovers on retry', async () => {
    details.mockRejectedValueOnce(new ApiError('Order not found.', { status: 404 }))
    const user = userEvent.setup()
    renderAt('/orders/99999')

    expect(await screen.findByText("Couldn't load this order")).toBeInTheDocument()
    expect(screen.getByText('Order not found.')).toBeInTheDocument()

    details.mockResolvedValue({ ...makeDetail(1), order_number: 99999, name: '#99999' })
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Order Summary')).toBeInTheDocument()
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
      await screen.findByText('Order Summary')

      expect(within(strip()).getByRole('button', { name: 'All Orders' })).toBeVisible()
      const tab = within(strip()).getByRole('button', { name: /^Order\s*17501$/ })
      expect(tab).toHaveAttribute('aria-current', 'page')
      expect(within(strip()).getByRole('button', { name: 'Close 17501' })).toBeVisible()
    })

    it('returns to the list from "All Orders" and back to the order from its tab', async () => {
      const user = await openFirst()
      await screen.findByText('Order Summary')

      await user.click(within(strip()).getByRole('button', { name: 'All Orders' }))
      expect(where()).toBe('/orders')
      expect(screen.getByRole('table')).toBeVisible()
      // The tab stays, now not the current one.
      const tab = within(strip()).getByRole('button', { name: /^Order\s*17501$/ })
      expect(tab).not.toHaveAttribute('aria-current')

      await user.click(tab)
      expect(where()).toBe('/orders/17501?shop=polymer-uk')
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Order 17501' }),
      ).toBeInTheDocument()
    })

    it('keeps every order opened this way as its own tab, and switches between them', async () => {
      const user = await openFirst()
      await screen.findByText('Order Summary')
      await user.click(within(strip()).getByRole('button', { name: 'All Orders' }))
      await user.click(screen.getByRole('button', { name: 'View order 17502' }))
      await screen.findByRole('heading', { level: 1, name: 'Order 17502' })

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
      await screen.findByText('Order Summary')
      await user.click(within(strip()).getByRole('button', { name: 'All Orders' }))
      await user.click(screen.getByRole('button', { name: 'View order 17502' }))
      await screen.findByRole('heading', { level: 1, name: 'Order 17502' })

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
      await screen.findByText('Order Summary')

      await user.click(within(strip()).getByRole('button', { name: 'Clear' }))

      expect(where()).toBe('/orders')
      expect(screen.queryByRole('navigation', { name: 'Open orders' })).toBeNull()
    })

    it('gives an order opened from a bare address a tab too, labelled with its number', async () => {
      renderAt('/orders/17503?shop=polymer-uk')
      await screen.findByText('Order Summary')

      expect(
        within(strip()).getByRole('button', { name: /^Order\s*17503$/ }),
      ).toHaveAttribute('aria-current', 'page')
    })
  })

  it('never asks for the raw Shopify payload', async () => {
    await openFirst()
    await screen.findByText('Order Summary')

    expect(screen.queryByRole('tab', { name: /raw/i })).toBeNull()
    // The call carries only the number and the store (include_raw=false is added by the API layer).
    for (const call of details.mock.calls) expect(call).toHaveLength(2)
  })
})
