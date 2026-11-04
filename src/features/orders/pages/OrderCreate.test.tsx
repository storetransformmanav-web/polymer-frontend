import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api/ApiError.ts'
import {
  api,
  type CustomerListResponse,
  type OrderListResponse,
  type ProductDetail,
  type ProductListResponse,
  type Shop,
} from '../../../lib/api/endpoints.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { OrdersPage } from './OrdersPage.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    orders: { list: vi.fn(), details: vi.fn(), create: vi.fn() },
    products: { list: vi.fn(), details: vi.fn() },
    customers: { list: vi.fn() },
    shops: { list: vi.fn() },
    auth: {},
  },
}))

const VARIANT_ID = '2503d64d-42b7-4261-afe4-14ef76bfea13'

const SHOP: Shop = {
  id: 's1',
  key: 'polymer-uk',
  name: 'Polymer UK',
  domain: 'uk.myshopify.com',
  currency: 'GBP',
  is_active: true,
  position: 0,
  connected: true,
  products_count: 0,
}

const EMPTY_ORDERS: OrderListResponse = {
  items: [],
  totals: { orders: 0, total_price: '0', total_refunded: '0', net_payment: '0' },
  page: 1,
  page_size: 25,
  total: 0,
  total_pages: 1,
  has_next: false,
  sort: 'created_at',
  order: 'desc',
}

const PRODUCTS = {
  items: [
    {
      id: 'product-1',
      title: 'Pizza Box',
      image_url: null,
      price_min: '10.00',
      price_max: '12.00',
      currency: 'GBP',
      variants_count: 2,
    },
  ],
  page: 1,
  page_size: 8,
  total: 1,
  total_pages: 1,
  has_next: false,
} as unknown as ProductListResponse

const PRODUCT = {
  id: 'product-1',
  title: 'Pizza Box',
  variants: [
    {
      id: VARIANT_ID,
      title: '12 inch',
      sku: 'PB12',
      price: '10.00',
      currency: 'GBP',
      inventory_quantity: 40,
      image_url: null,
    },
    {
      id: 'variant-2',
      title: '14 inch',
      sku: 'PB14',
      price: '12.00',
      currency: 'GBP',
      inventory_quantity: 0,
      image_url: null,
    },
  ],
} as unknown as ProductDetail

const CUSTOMERS = {
  items: [
    {
      id: 'c1',
      email: 'buyer@example.com',
      full_name: 'Sam Taylor',
      first_name: 'Sam',
      last_name: 'Taylor',
      phone: '+447700900123',
    },
  ],
  total: 1,
} as unknown as CustomerListResponse

const ordersList = vi.mocked(api.orders.list)
const details = vi.mocked(api.orders.details)
const create = vi.mocked(api.orders.create)
const productsList = vi.mocked(api.products.list)
const productDetails = vi.mocked(api.products.details)
const customersList = vi.mocked(api.customers.list)
const shopsList = vi.mocked(api.shops.list)

const never = () => new Promise<never>(() => undefined)

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

async function openForm() {
  const user = userEvent.setup()
  const view = renderAt()
  await user.click(await screen.findByRole('button', { name: 'Add order' }))
  const form = screen.getByRole('region', { name: 'Add order' })
  // The store list has loaded (the Store dropdown has its store).
  await waitFor(() =>
    expect(within(form).getByLabelText('Store')).toHaveValue('polymer-uk'),
  )
  return { user, form, ...view }
}

describe('Add order', () => {
  beforeEach(() => {
    shopsList.mockResolvedValue([SHOP])
    ordersList.mockResolvedValue(EMPTY_ORDERS)
    details.mockImplementation(never)
    productsList.mockResolvedValue(PRODUCTS)
    productDetails.mockResolvedValue(PRODUCT)
    customersList.mockResolvedValue(CUSTOMERS)
    create.mockResolvedValue({
      id: 'order-new',
      order_number: 17600,
      name: '#17600',
      shop: 'polymer-uk',
      message: 'Order #17600 created in Shopify.',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('opens in place of the list as a "New order" tab, and asks for nothing until something is typed', async () => {
    const { form } = await openForm()

    expect(where()).toBe('/orders/new')
    expect(within(form).getByRole('heading', { name: 'Add order' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^Order\s*New order$/ }),
    ).toBeInTheDocument()
    // The list stays mounted behind the form, only hidden (display: none).
    expect(
      screen.getByRole('region', { name: 'Orders' }).closest('.hidden'),
    ).not.toBeNull()
    expect(productsList).not.toHaveBeenCalled()
    expect(customersList).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it('opening /orders/new directly starts the form', async () => {
    renderAt('/orders/new')
    expect(await screen.findByRole('heading', { name: 'Add order' })).toBeInTheDocument()
  })

  it('sends the documented example request once "Yes, create" is pressed, then opens the new order', async () => {
    const { user, form } = await openForm()

    // Products: search, open the product, add its 12 inch variant twice.
    await user.type(within(form).getByLabelText('Search products'), 'pizza')
    await waitFor(() =>
      expect(productsList).toHaveBeenCalledWith({
        search: 'pizza',
        shop: 'polymer-uk',
        page_size: 8,
        sort: 'title',
        order: 'asc',
      }),
    )
    await user.click(await within(form).findByRole('button', { name: /Pizza Box/ }))
    const add = await within(form).findByRole('button', {
      name: 'Add Pizza Box – 12 inch',
    })
    await user.click(add)
    await user.click(add)
    expect(within(form).getByLabelText('Quantity of Pizza Box')).toHaveValue('2')

    // A custom item.
    await user.click(within(form).getByRole('button', { name: 'Add custom item' }))
    await user.type(within(form).getByLabelText('Item name'), 'Custom printing')
    await user.type(within(form).getByLabelText('Price'), '25.00')

    // The customer, found in the store.
    const customer = within(screen.getByRole('region', { name: 'Customer' }))
    await user.type(customer.getByLabelText('Find a customer'), 'sam')
    await user.click(await customer.findByRole('button', { name: /Sam Taylor/ }))
    expect(customer.getByLabelText('Email')).toHaveValue('buyer@example.com')
    expect(customer.getByLabelText(/Phone/)).toHaveValue('+447700900123')

    // The shipping address.
    const address = within(screen.getByRole('region', { name: 'Shipping address' }))
    await user.click(
      address.getByRole('button', { name: 'Use the customer’s name and phone' }),
    )
    await user.type(address.getByLabelText(/Company/), 'Taylor Foods Ltd')
    await user.type(address.getByLabelText('Address'), '1 High Street')
    await user.type(address.getByLabelText('City'), 'London')
    await user.type(address.getByLabelText(/Postcode/), 'NW10 7RX')
    await user.selectOptions(address.getByLabelText('Country'), 'GB')

    // Delivery, payment, codes, tags and a note.
    await user.type(within(form).getByLabelText(/Delivery method/), 'Next day delivery')
    await user.type(within(form).getByLabelText(/Delivery price/), '6.95')
    await user.selectOptions(within(form).getByLabelText('Payment status'), 'paid')
    await user.type(within(form).getByLabelText(/Payment method/), 'Bank Transfer')
    await user.type(within(form).getByLabelText(/Discount codes/), 'WELCOME10{Enter}')
    await user.type(within(form).getByLabelText(/Tags/), 'crm{Enter}')
    await user.type(within(form).getByLabelText(/Note/), 'Phone order')

    // The summary follows: 2 × 10.00 + 25.00 + 6.95.
    expect(
      within(screen.getByRole('region', { name: 'Summary' })).getByText('£51.95'),
    ).toBeInTheDocument()

    await user.click(within(form).getAllByRole('button', { name: 'Create order' })[0])
    const dialog = await screen.findByRole('alertdialog', { name: 'Create this order?' })
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(create).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Yes, create' }))

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    expect(create).toHaveBeenCalledWith({
      shop: 'polymer-uk',
      customer: {
        email: 'buyer@example.com',
        first_name: 'Sam',
        last_name: 'Taylor',
        phone: '+447700900123',
      },
      shipping_address: {
        first_name: 'Sam',
        last_name: 'Taylor',
        company: 'Taylor Foods Ltd',
        address1: '1 High Street',
        city: 'London',
        zip: 'NW10 7RX',
        country_code: 'GB',
        phone: '+447700900123',
      },
      line_items: [
        { variant_id: VARIANT_ID, quantity: 2 },
        {
          title: 'Custom printing',
          price: '25.00',
          quantity: 1,
          taxable: true,
          requires_shipping: false,
        },
      ],
      discount_codes: ['WELCOME10'],
      shipping: { title: 'Next day delivery', price: '6.95' },
      note: 'Phone order',
      tags: ['crm'],
      payment: { status: 'paid', method: 'Bank Transfer' },
    })

    // The new order opens in its own tab, with the store's message; the list is re-read.
    await waitFor(() => expect(where()).toBe('/orders/17600?shop=polymer-uk'))
    expect(screen.getByText('Order #17600 created in Shopify.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close 17600' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Close New order' }),
    ).not.toBeInTheDocument()
    expect(details).toHaveBeenCalledWith('17600', 'polymer-uk')
    await waitFor(() => expect(ordersList.mock.calls.length).toBeGreaterThanOrEqual(2))
  }, 30000)

  it('checks every field first: nothing is asked or sent, and the problems show', async () => {
    const { user, form } = await openForm()

    await user.click(within(form).getAllByRole('button', { name: 'Create order' })[0])

    expect(
      within(form).getByText('Fix the highlighted fields to create the order.'),
    ).toBeInTheDocument()
    expect(
      within(form).getByText('Add at least one product or custom item.'),
    ).toHaveFocus()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it('keeps the question open with the backend’s message when the store refuses, and keeps what was typed', async () => {
    create.mockRejectedValue(
      new ApiError('Discount code WELCOME10 does not exist.', { status: 422 }),
    )
    const { user, form } = await openForm()
    await user.click(within(form).getByRole('button', { name: 'Add custom item' }))
    await user.type(within(form).getByLabelText('Item name'), 'Setup fee')
    await user.type(within(form).getByLabelText('Price'), '7')

    await user.click(within(form).getAllByRole('button', { name: 'Create order' })[0])
    const dialog = await screen.findByRole('alertdialog', { name: 'Create this order?' })
    await user.click(within(dialog).getByRole('button', { name: 'Yes, create' }))

    expect(
      await within(dialog).findByText('Discount code WELCOME10 does not exist.'),
    ).toBeInTheDocument()
    expect(create).toHaveBeenCalledTimes(1)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(where()).toBe('/orders/new')
    expect(within(form).getByLabelText('Item name')).toHaveValue('Setup fee')
  })

  it('asks before throwing away what was typed, and Back with nothing typed just goes back', async () => {
    const { user, form } = await openForm()
    await user.click(within(form).getByRole('button', { name: 'Back to list' }))
    expect(where()).toBe('/orders')

    await user.click(screen.getByRole('button', { name: 'Add order' }))
    const again = screen.getByRole('region', { name: 'Add order' })
    await user.click(within(again).getByRole('button', { name: 'Add custom item' }))
    await user.click(within(again).getByRole('button', { name: 'Back to list' }))
    const ask = await screen.findByRole('alertdialog', { name: /Discard this new order/ })
    await user.click(within(ask).getByRole('button', { name: 'Yes, discard' }))
    expect(where()).toBe('/orders')
  })

  it('keeps the form, with what was typed, while the list is shown, and its tab brings it back', async () => {
    const { user, form } = await openForm()
    await user.type(within(form).getByLabelText(/Note/), 'Keep me')

    await user.click(screen.getByRole('button', { name: 'All Orders' }))
    expect(where()).toBe('/orders')
    await user.click(screen.getByRole('button', { name: /^Order\s*New order$/ }))
    expect(where()).toBe('/orders/new')
    expect(
      within(screen.getByRole('region', { name: 'Add order' })).getByLabelText(/Note/),
    ).toHaveValue('Keep me')
  })
})
