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
      inventory_quantity: 25,
      image_url: null,
    },
    {
      id: 'variant-3',
      title: '16 inch',
      sku: 'PB16',
      price: '14.00',
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

type User = ReturnType<typeof userEvent.setup>

async function openForm() {
  const user = userEvent.setup()
  const view = renderAt()
  await user.click(await screen.findByRole('button', { name: 'Add order' }))
  const form = screen.getByRole('region', { name: 'Create order' })
  // The store list has loaded (the Store dropdown has its store).
  await waitFor(() =>
    expect(within(form).getByLabelText('Store')).toHaveValue('polymer-uk'),
  )
  return { user, form, ...view }
}

const next = (user: User, form: HTMLElement) =>
  user.click(within(form).getByRole('button', { name: /^Next/ }))

const currentStep = () =>
  within(screen.getByRole('navigation', { name: 'Order steps' })).getByRole('listitem', {
    current: 'step',
  }).textContent

/** Searches for the pizza box in the Items step and adds its 12 inch variant once. */
async function addPizza(user: User, form: HTMLElement) {
  await user.type(within(form).getByLabelText('Search products'), 'pizza')
  await user.click(await within(form).findByRole('button', { name: /Pizza Box/ }))
  await user.click(
    await within(form).findByRole('button', { name: 'Add Pizza Box – 12 inch' }),
  )
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

  it('opens in place of the list as a "New order" tab, on step 1, and asks for nothing until something is typed', async () => {
    const { form } = await openForm()

    expect(where()).toBe('/orders/new')
    expect(
      within(form).getByRole('heading', { name: 'Create Order' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^Order\s*New order$/ }),
    ).toBeInTheDocument()
    // The four steps; the first is current.
    expect(currentStep()).toContain('Order & Customer')
    for (const label of ['Addresses', 'Items', 'Review & Create']) {
      expect(
        within(form).getByRole('button', { name: new RegExp(`^Step \\d: ${label}`) }),
      ).toBeInTheDocument()
    }
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
    expect(
      await screen.findByRole('heading', { name: 'Create Order' }),
    ).toBeInTheDocument()
  })

  it('only lets the stepper go to steps already reached', async () => {
    const { user, form } = await openForm()
    expect(within(form).getByRole('button', { name: /^Step 3: Items/ })).toBeDisabled()

    await next(user, form)
    expect(currentStep()).toContain('Addresses')
    await user.click(within(form).getByRole('button', { name: /^Step 1:/ }))
    expect(currentStep()).toContain('Order & Customer')
    // Step 2 was reached, so it can be pressed again; step 3 was not.
    expect(within(form).getByRole('button', { name: /^Step 2:/ })).toBeEnabled()
    expect(within(form).getByRole('button', { name: /^Step 3: Items/ })).toBeDisabled()
  })

  it('only an existing customer can be chosen: the details are read-only and there is no way to add a new one', async () => {
    const { user, form } = await openForm()

    // No boxes to type a customer into, and no Add Customer button.
    expect(within(form).queryByLabelText(/^Email/)).not.toBeInTheDocument()
    expect(within(form).queryByLabelText('First Name')).not.toBeInTheDocument()
    expect(
      within(form).queryByRole('button', { name: 'Add Customer' }),
    ).not.toBeInTheDocument()

    await user.type(within(form).getByLabelText('Find a customer'), 'sam')
    await user.click(await within(form).findByRole('button', { name: /Sam Taylor/ }))
    expect(customersList).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'sam', role: 'all', shop: 'polymer-uk' }),
    )

    // The chosen customer's details are shown as text, not as boxes.
    const details = within(form).getByLabelText('Customer details')
    expect(within(details).getByText('buyer@example.com')).toBeInTheDocument()
    expect(within(details).getByText('Sam')).toBeInTheDocument()
    expect(within(details).getByText('+447700900123')).toBeInTheDocument()
    expect(within(form).queryByLabelText(/^Email/)).not.toBeInTheDocument()

    // The ✕ takes the customer off and the search is back.
    await user.click(within(form).getByRole('button', { name: 'Clear customer' }))
    expect(within(form).queryByLabelText('Customer details')).not.toBeInTheDocument()
    expect(within(form).getByLabelText('Find a customer')).toBeInTheDocument()
  })

  it('step 1: with a customer chosen, Next goes on to the addresses', async () => {
    const { user, form } = await openForm()
    await user.type(within(form).getByLabelText('Find a customer'), 'sam')
    await user.click(await within(form).findByRole('button', { name: /Sam Taylor/ }))
    await next(user, form)
    expect(currentStep()).toContain('Addresses')
  })

  it('lists every product in stock as soon as the product box is focused, and leaves out sold-out variants', async () => {
    const { user, form } = await openForm()
    await next(user, form)
    await next(user, form)
    expect(productsList).not.toHaveBeenCalled()

    // Nothing typed: the whole in-stock list (A–Z, 20 at a time), asked for with in_stock=true.
    await user.click(within(form).getByLabelText('Search products'))
    await waitFor(() =>
      expect(productsList).toHaveBeenCalledWith({
        shop: 'polymer-uk',
        in_stock: true,
        page: 1,
        page_size: 20,
        sort: 'title',
        order: 'asc',
      }),
    )
    await user.click(await within(form).findByRole('button', { name: /Pizza Box/ }))
    expect(
      await within(form).findByRole('button', { name: 'Add Pizza Box – 12 inch' }),
    ).toBeInTheDocument()
    // The 16 inch variant has no stock: it is not offered (the 14 inch one is).
    expect(within(form).getByText('14 inch')).toBeInTheDocument()
    expect(within(form).queryByText('16 inch')).not.toBeInTheDocument()
  })

  it('step 2: an address needs a street, a city and a country, and a delivery cost needs a method', async () => {
    const { user, form } = await openForm()
    await next(user, form)

    await user.type(within(form).getByLabelText('Company'), 'Taylor Foods')
    await next(user, form)
    expect(within(form).getByText('Enter the street address.')).toBeInTheDocument()
    expect(within(form).getByText('Enter the town or city.')).toBeInTheDocument()
    expect(within(form).getByText('Choose the country.')).toBeInTheDocument()
    expect(currentStep()).toContain('Addresses')

    await user.clear(within(form).getByLabelText('Company'))
    await user.type(within(form).getByLabelText(/Shipping cost/), '5')
    await next(user, form)
    expect(
      within(form).getByText('Name the delivery, e.g. Next day delivery.'),
    ).toBeInTheDocument()

    await user.type(within(form).getByLabelText(/Shipping method/), 'Collection')
    await next(user, form)
    expect(currentStep()).toContain('Items')
  })

  it('step 3: only the store’s products can be added, Add becomes a counter, and − at 1 removes it', async () => {
    const { user, form } = await openForm()
    await next(user, form)
    await next(user, form)

    // There is no way to add a custom item.
    expect(
      within(form).queryByRole('tab', { name: 'Custom item' }),
    ).not.toBeInTheDocument()
    expect(within(form).queryByLabelText('Item name')).not.toBeInTheDocument()

    // Next with no item stops here.
    await next(user, form)
    expect(within(form).getByText('Add at least one product.')).toHaveFocus()
    expect(currentStep()).toContain('Items')

    // The search lists the product with its price range; opening it lists its variants.
    await user.type(within(form).getByLabelText('Search products'), 'pizza')
    await user.click(await within(form).findByRole('button', { name: /Pizza Box/ }))
    const add = await within(form).findByRole('button', {
      name: 'Add Pizza Box – 12 inch',
    })
    await user.click(add)

    // Add gave way to a counter at 1; + and − change it, and the order has one line.
    expect(
      within(form).queryByRole('button', { name: 'Add Pizza Box – 12 inch' }),
    ).not.toBeInTheDocument()
    const counter = within(
      within(form).getByRole('group', { name: 'Quantity of Pizza Box – 12 inch' }),
    )
    await user.click(
      counter.getByRole('button', { name: 'One more of Pizza Box – 12 inch' }),
    )
    expect(counter.getByText('2')).toBeInTheDocument()
    expect(within(form).getByLabelText('Quantity of Pizza Box')).toHaveValue('2')
    expect(screen.getAllByRole('row')).toHaveLength(2)

    // Another variant is a second line.
    await user.click(
      await within(form).findByRole('button', { name: 'Add Pizza Box – 14 inch' }),
    )
    expect(screen.getAllByRole('row')).toHaveLength(3)

    // The summary follows: 2 × 10.00 + 1 × 12.00.
    expect(
      within(screen.getByRole('complementary', { name: 'Order Summary' })).getAllByText(
        '£32.00',
      ).length,
    ).toBeGreaterThan(0)

    // − takes one off; at 1 it takes the line away and Add comes back.
    await user.click(
      counter.getByRole('button', { name: 'One fewer of Pizza Box – 12 inch' }),
    )
    await user.click(counter.getByRole('button', { name: 'Remove Pizza Box – 12 inch' }))
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(
      await within(form).findByRole('button', { name: 'Add Pizza Box – 12 inch' }),
    ).toBeInTheDocument()

    await next(user, form)
    expect(currentStep()).toContain('Review & Create')
  })

  it('sends the documented example request once "Yes, create" is pressed, then opens the new order', async () => {
    const { user, form } = await openForm()

    // 1 · Order & Customer: payment, codes, tags, the customer and the note.
    await user.selectOptions(within(form).getByLabelText('Payment status'), 'paid')
    await user.type(within(form).getByLabelText(/Payment method/), 'Bank Transfer')
    await user.type(within(form).getByLabelText(/Discount codes/), 'WELCOME10{Enter}')
    await user.type(within(form).getByLabelText(/^Tags/), 'crm{Enter}')
    await user.type(within(form).getByLabelText('Find a customer'), 'sam')
    await user.click(await within(form).findByRole('button', { name: /Sam Taylor/ }))
    await user.type(within(form).getByRole('textbox', { name: 'Notes' }), 'Phone order')
    await next(user, form)

    // 2 · Addresses: the delivery address, then the delivery.
    await user.click(
      within(form).getByRole('button', { name: 'Use the customer’s name and phone' }),
    )
    await user.type(within(form).getByLabelText('Company'), 'Taylor Foods Ltd')
    await user.type(within(form).getByLabelText(/^Address/), '1 High Street')
    await user.type(within(form).getByLabelText(/^City/), 'London')
    await user.type(within(form).getByLabelText('Postcode'), 'NW10 7RX')
    await user.selectOptions(within(form).getByLabelText('Country'), 'GB')
    await user.type(within(form).getByLabelText(/Shipping method/), 'Next day delivery')
    await user.type(within(form).getByLabelText(/Shipping cost/), '6.95')
    await next(user, form)

    // 3 · Items: search, open the product, add its 12 inch variant twice.
    await user.type(within(form).getByLabelText('Search products'), 'pizza')
    await waitFor(() =>
      expect(productsList).toHaveBeenCalledWith({
        search: 'pizza',
        shop: 'polymer-uk',
        in_stock: true,
        page: 1,
        page_size: 20,
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
    await next(user, form)

    // 4 · Review & Create: all of it laid out; 2 × 10.00 + 6.95.
    expect(currentStep()).toContain('Review & Create')
    const review = within(form)
    // The customer's name, and the name on the delivery address.
    expect(review.getAllByText('Sam Taylor')).toHaveLength(2)
    expect(review.getByText('Taylor Foods Ltd')).toBeInTheDocument()
    expect(review.getByText('United Kingdom')).toBeInTheDocument()
    expect(review.getByText('Next day delivery')).toBeInTheDocument()
    expect(review.getByText('Phone order')).toBeInTheDocument()
    expect(review.getByText('WELCOME10')).toBeInTheDocument()
    expect(review.getByText('Pizza Box')).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: 'Order total' })).getByText('£26.95'),
    ).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()

    await user.click(review.getByRole('button', { name: 'Create order' }))
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
      line_items: [{ variant_id: VARIANT_ID, quantity: 2 }],
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
  }, 60000)

  it('Edit on the review goes back to that step with everything still typed, and Back steps back one', async () => {
    const { user, form } = await openForm()
    await user.type(within(form).getByRole('textbox', { name: 'Notes' }), 'Keep me')
    await next(user, form)
    await next(user, form)
    await addPizza(user, form)
    await next(user, form)

    await user.click(within(form).getByRole('button', { name: 'Edit items (1)' }))
    expect(currentStep()).toContain('Items')
    expect(screen.getByRole('table', { name: 'Order items' })).toBeInTheDocument()
    await next(user, form)
    await user.click(
      within(form).getByRole('button', { name: 'Edit store and customer' }),
    )
    expect(currentStep()).toContain('Order & Customer')
    expect(within(form).getByRole('textbox', { name: 'Notes' })).toHaveValue('Keep me')

    await user.click(within(form).getByRole('button', { name: /^Step 4:/ }))
    await user.click(within(form).getByRole('button', { name: 'Back' }))
    expect(currentStep()).toContain('Items')
  })

  it('Create order checks every step: a problem found on an earlier one takes you back to it, and nothing is sent', async () => {
    const { user, form } = await openForm()
    await next(user, form)
    await next(user, form)
    await addPizza(user, form)
    await next(user, form)
    expect(currentStep()).toContain('Review & Create')

    // Go back, spoil step 2 (a company with no street), and jump straight to the review through the stepper.
    await user.click(within(form).getByRole('button', { name: /^Step 2:/ }))
    await user.type(within(form).getByLabelText('Company'), 'Taylor Foods')
    await user.click(within(form).getByRole('button', { name: /^Step 4:/ }))
    await user.click(within(form).getByRole('button', { name: 'Create order' }))

    expect(currentStep()).toContain('Addresses')
    expect(within(form).getByText('Enter the street address.')).toBeInTheDocument()
    // The stepper marks a step with a problem when you are elsewhere.
    await user.click(within(form).getByRole('button', { name: /^Step 1:/ }))
    expect(
      within(form).getByRole('button', {
        name: 'Step 2: Addresses (needs attention)',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it('keeps the question open with the backend’s message when the store refuses, and keeps what was typed', async () => {
    create.mockRejectedValue(
      new ApiError('Discount code WELCOME10 does not exist.', { status: 422 }),
    )
    const { user, form } = await openForm()
    await next(user, form)
    await next(user, form)
    await addPizza(user, form)
    await next(user, form)

    await user.click(within(form).getByRole('button', { name: 'Create order' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Create this order?' })
    await user.click(within(dialog).getByRole('button', { name: 'Yes, create' }))

    expect(
      await within(dialog).findByText('Discount code WELCOME10 does not exist.'),
    ).toBeInTheDocument()
    expect(create).toHaveBeenCalledTimes(1)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(where()).toBe('/orders/new')
    expect(within(form).getByText('Pizza Box')).toBeInTheDocument()
  })

  it('asks before throwing away what was typed, and Cancel with nothing typed just goes back', async () => {
    const { user, form } = await openForm()
    await user.click(within(form).getByRole('button', { name: 'Cancel' }))
    expect(where()).toBe('/orders')

    await user.click(screen.getByRole('button', { name: 'Add order' }))
    const again = screen.getByRole('region', { name: 'Create order' })
    await user.type(within(again).getByRole('textbox', { name: 'Notes' }), 'x')
    await user.click(within(again).getByRole('button', { name: 'Back to list' }))
    const ask = await screen.findByRole('alertdialog', { name: /Discard this new order/ })
    await user.click(within(ask).getByRole('button', { name: 'Yes, discard' }))
    expect(where()).toBe('/orders')
  })

  it('keeps the form, with what was typed, while the list is shown, and its tab brings it back', async () => {
    const { user, form } = await openForm()
    await user.type(within(form).getByRole('textbox', { name: 'Notes' }), 'Keep me')
    await next(user, form)

    await user.click(screen.getByRole('button', { name: 'All Orders' }))
    expect(where()).toBe('/orders')
    await user.click(screen.getByRole('button', { name: /^Order\s*New order$/ }))
    expect(where()).toBe('/orders/new')
    const again = within(screen.getByRole('region', { name: 'Create order' }))
    // Still on the second step; the note is on the first.
    expect(currentStep()).toContain('Addresses')
    await user.click(again.getByRole('button', { name: /^Step 1:/ }))
    expect(again.getByRole('textbox', { name: 'Notes' })).toHaveValue('Keep me')
  })
})
