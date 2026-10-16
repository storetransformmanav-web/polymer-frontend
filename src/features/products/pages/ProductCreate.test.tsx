import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api/ApiError.ts'
import {
  api,
  type ProductCreateResult,
  type ProductListItem,
  type ProductListResponse,
  type Shop,
} from '../../../lib/api/endpoints.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { ProductsPage } from './ProductsPage.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    shops: { list: vi.fn() },
    inventory: { locations: vi.fn() },
    products: {
      list: vi.fn(),
      details: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      syncHistory: vi.fn(),
    },
    auth: {},
  },
}))

function shop(overrides: Partial<Shop>): Shop {
  return {
    id: 'id',
    key: null,
    name: null,
    domain: 'x.myshopify.com',
    is_active: true,
    position: 0,
    connected: true,
    products_count: 0,
    ...overrides,
  }
}

const SHOPS = [
  shop({
    id: 's1',
    key: 'polymer-uk',
    name: 'Polymer UK',
    domain: 'uk.myshopify.com',
    currency: 'GBP',
  }),
  shop({
    id: 's2',
    key: 'polymer-eu',
    name: 'Polymer EU',
    domain: 'eu.myshopify.com',
    currency: 'EUR',
  }),
]

function row(id: string, title: string): ProductListItem {
  return {
    shop: {
      key: 'polymer-uk',
      name: 'Polymer UK',
      domain: 'uk.myshopify.com',
      currency: 'GBP',
    },
    id,
    shopify_id: Number(id.replace('id-', '')),
    title,
    handle: title.toLowerCase().replace(/ /g, '-'),
    status: 'ACTIVE',
    vendor: 'Polymer',
    product_type: 'Bags',
    category_name: null,
    tags: [],
    image_url: null,
    price_min: '6.00',
    price_max: '6.00',
    currency: 'GBP',
    variants_count: 1,
    total_inventory: 5,
    shopify_created_at: null,
    shopify_updated_at: null,
    synced_at: '2026-01-01T00:00:00Z',
  }
}

const EXISTING = row('id-1', 'Hippo Bag')

function page(items: ProductListItem[]): ProductListResponse {
  return {
    items,
    page: 1,
    page_size: 25,
    total: items.length,
    total_pages: 1,
    has_next: false,
    sort: 'created_at',
    order: 'desc',
  }
}

const CREATED: ProductCreateResult = {
  product_id: 'new-id',
  shopify_id: 999,
  shopify_gid: 'gid://shopify/Product/999',
  handle: 'sushi-tray',
  title: 'Sushi Tray',
  status: 'DRAFT',
  shop: 'polymer-uk',
  variants: 1,
  media: 0,
  message: 'Product created in Shopify and the CRM',
}

const list = vi.mocked(api.products.list)
const create = vi.mocked(api.products.create)
const shopsList = vi.mocked(api.shops.list)
const locations = vi.mocked(api.inventory.locations)
const never = () => new Promise<never>(() => undefined)

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/products/*" element={<ProductsPage />} />
    </Routes>,
    { route: '/products' },
  )
}

describe('adding a product', () => {
  beforeEach(() => {
    list.mockResolvedValue(page([EXISTING]))
    shopsList.mockResolvedValue(SHOPS)
    locations.mockResolvedValue([])
    create.mockResolvedValue(CREATED)
    vi.mocked(api.products.syncHistory).mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  async function openForm() {
    const user = userEvent.setup()
    const view = renderPage()
    await screen.findByLabelText('Select Hippo Bag')
    await user.click(screen.getByRole('button', { name: 'Add product' }))
    const form = await screen.findByRole('region', { name: 'Add product' })
    return { user, form, ...view }
  }

  const submit = (form: HTMLElement) =>
    within(form).getAllByRole('button', { name: 'Create product' })[0]

  /** The smallest valid product. */
  async function fillBasics(user: ReturnType<typeof userEvent.setup>, form: HTMLElement) {
    await user.type(within(form).getByLabelText('Title'), 'Sushi Tray')
    await user.type(within(form).getByLabelText('Price'), '9.99')
  }

  it('has an Add product button, even when there are no products yet', async () => {
    list.mockResolvedValue(page([]))
    renderPage()

    expect(await screen.findByRole('button', { name: 'Add product' })).toBeInTheDocument()
    // Nothing to bulk-edit, though.
    expect(screen.getByRole('button', { name: 'Edit in bulk' })).toBeDisabled()
  })

  it('opens a form in place of the list, with the cursor in the title', async () => {
    const { form } = await openForm()

    expect(within(form).getByLabelText('Title')).toHaveFocus()
    for (const name of [
      'Basics',
      'Media',
      'Options and variants',
      'Search listing',
      'Metafields',
      'Status and store',
      'Organization',
    ]) {
      expect(within(form).getByRole('region', { name })).toBeInTheDocument()
    }
    expect(create).not.toHaveBeenCalled()
  })

  it('checks the fields first and sends nothing while something is missing', async () => {
    const { user, form } = await openForm()
    await user.click(submit(form))

    expect(await within(form).findByText('Enter a title')).toBeInTheDocument()
    expect(within(form).getByText('Enter a price')).toBeInTheDocument()
    expect(
      screen.getByText('Fix the highlighted fields to create the product.'),
    ).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it('creates a simple product in the store picked at the top (the first one by default)', async () => {
    const { user, form } = await openForm()
    await fillBasics(user, form)
    await user.click(submit(form))

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    expect(create.mock.calls[0][0]).toEqual({
      shop: 'polymer-uk',
      title: 'Sushi Tray',
      status: 'DRAFT',
      gift_card: false,
      variants: [
        {
          price: '9.99',
          taxable: true,
          inventory_policy: 'DENY',
          tracked: true,
          requires_shipping: true,
        },
      ],
    })
  })

  it('lets another store be chosen', async () => {
    const { user, form } = await openForm()
    await fillBasics(user, form)
    await user.selectOptions(within(form).getByLabelText('Store'), 'Polymer EU')
    await user.click(submit(form))

    await waitFor(() => expect(create).toHaveBeenCalled())
    expect(create.mock.calls[0][0].shop).toBe('polymer-eu')
  })

  it('puts the new product at the top of the list at once, with the counts, before anything is re-read', async () => {
    const { user, form } = await openForm()
    await fillBasics(user, form)
    // The list has not been read again yet — what shows is the instant insertion.
    list.mockImplementation(never)
    await user.click(submit(form))

    expect(await screen.findByText(/Created “Sushi Tray”/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Add product' })).not.toBeInTheDocument()

    const rows = screen.getAllByRole('row')
    // Header, then the new product above the existing one.
    expect(within(rows[1]).getByText('Sushi Tray')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Hippo Bag')).toBeInTheDocument()
    expect(within(rows[1]).getByText('£9.99')).toBeInTheDocument()
    // "All Products" went from 1 to 2.
    expect(screen.getByRole('button', { name: /^All Products\s*2$/ })).toBeInTheDocument()
  })

  it('shows it is creating, and locks the form meanwhile', async () => {
    create.mockImplementation(never)
    const { user, form } = await openForm()
    await fillBasics(user, form)
    await user.click(submit(form))

    await waitFor(() =>
      expect(
        within(form).getAllByRole('button', { name: 'Creating…' })[0],
      ).toBeDisabled(),
    )
    expect(within(form).getByRole('button', { name: 'Back' })).toBeDisabled()
    expect(create).toHaveBeenCalledTimes(1)
  })

  it("keeps the form, with everything typed, and shows the backend's message when it fails", async () => {
    create.mockRejectedValue(
      new ApiError('A product with this handle already exists.', { status: 422 }),
    )
    const { user, form } = await openForm()
    await fillBasics(user, form)
    await user.click(submit(form))

    expect(
      await screen.findByText('A product with this handle already exists.'),
    ).toBeInTheDocument()
    expect(within(form).getByLabelText('Title')).toHaveValue('Sushi Tray')
    expect(submit(form)).toBeEnabled()
    // Nothing was added to the list.
    expect(screen.queryByText(/Created/)).not.toBeInTheDocument()
  })

  it('asks before throwing away what was entered, and goes straight back when nothing was', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { user, form } = await openForm()

    await user.click(within(form).getByRole('button', { name: 'Back' }))
    expect(confirm).not.toHaveBeenCalled()
    expect(screen.queryByRole('region', { name: 'Add product' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add product' }))
    const again = await screen.findByRole('region', { name: 'Add product' })
    await user.type(within(again).getByLabelText('Title'), 'Half done')
    await user.click(within(again).getByRole('button', { name: 'Back' }))
    expect(confirm).toHaveBeenCalled()
    expect(screen.getByRole('region', { name: 'Add product' })).toBeInTheDocument()

    confirm.mockReturnValue(true)
    await user.click(within(again).getByRole('button', { name: 'Back' }))
    expect(screen.queryByRole('region', { name: 'Add product' })).not.toBeInTheDocument()
  })

  it('makes a variant for every combination of the options, each with its own price', async () => {
    const { user, form } = await openForm()
    await user.type(within(form).getByLabelText('Title'), 'Sushi Tray')
    await user.type(within(form).getByLabelText('Price'), '5')
    await user.click(
      within(form).getByRole('button', { name: 'Add options like size or colour' }),
    )
    await user.type(within(form).getByLabelText('Option name'), 'Size')
    await user.type(
      within(form).getByLabelText('Add values for option 1'),
      'Small, Large{Enter}',
    )

    // The price typed so far carries over to the new variants.
    expect(within(form).getByLabelText('Price for Small')).toHaveValue('5')
    expect(within(form).getByLabelText('Price for Large')).toHaveValue('5')
    await user.clear(within(form).getByLabelText('Price for Large'))
    await user.type(within(form).getByLabelText('Price for Large'), '7.5')
    await user.type(within(form).getByLabelText('SKU for Small'), 'TRAY-S')
    await user.click(submit(form))

    await waitFor(() => expect(create).toHaveBeenCalled())
    const body = create.mock.calls[0][0]
    expect(body.options).toEqual([{ name: 'Size', values: ['Small', 'Large'] }])
    expect(body.variants).toMatchObject([
      { option_values: ['Small'], price: '5', sku: 'TRAY-S' },
      { option_values: ['Large'], price: '7.5' },
    ])
  })

  it('sends the opening stock when a location is chosen', async () => {
    locations.mockResolvedValue([{ id: 77, name: 'Warehouse', variants: 3 }])
    const { user, form } = await openForm()
    await fillBasics(user, form)
    await user.selectOptions(
      await within(form).findByLabelText('Opening stock location'),
      'Warehouse',
    )
    // The stock box only appears once a location is chosen.
    await user.type(form.querySelector('#create-stock') as HTMLElement, '12')
    await user.click(submit(form))

    await waitFor(() => expect(create).toHaveBeenCalled())
    expect(create.mock.calls[0][0].variants[0].stock).toEqual([
      { location_id: 77, available: 12 },
    ])
    expect(locations).toHaveBeenCalledWith('polymer-uk')
  })

  it('lets the location ID be typed when the store has no stock locations on record, so stock can still be added', async () => {
    locations.mockResolvedValue([])
    const { user, form } = await openForm()
    await fillBasics(user, form)
    // No choice of locations — a plain box for the Shopify location number, with a hint where to find it.
    expect(
      within(form).queryByLabelText('Opening stock location'),
    ).not.toBeInTheDocument()
    expect(within(form).getByText(/Settings → Locations/)).toBeInTheDocument()
    // The stock box shows up once a location is given; letters are not accepted in the ID.
    expect(form.querySelector('#create-stock')).toBeNull()
    await user.type(form.querySelector('#create-location-id') as HTMLElement, '72a84')
    expect(form.querySelector('#create-location-id')).toHaveValue('7284')
    await user.type(form.querySelector('#create-stock') as HTMLElement, '30')
    await user.click(submit(form))

    await waitFor(() => expect(create).toHaveBeenCalled())
    expect(create.mock.calls[0][0].variants[0].stock).toEqual([
      { location_id: 7284, available: 30 },
    ])
  })

  it('sends the description from the rich-text editor’s HTML view', async () => {
    const { user, form } = await openForm()
    await fillBasics(user, form)
    await user.click(await within(form).findByRole('button', { name: 'Edit HTML' }))
    await user.type(within(form).getByLabelText('Description (HTML)'), 'Brand new copy')
    await user.click(submit(form))

    await waitFor(() => expect(create).toHaveBeenCalled())
    expect(create.mock.calls[0][0].description_html).toBe('Brand new copy')
  })

  it('sends tags, collections, media, SEO and metafields that were entered', async () => {
    const { user, form } = await openForm()
    await fillBasics(user, form)
    await user.type(within(form).getByLabelText(/^Vendor/), 'Polymer')
    await user.type(within(form).getByLabelText('Add tags'), 'eco, tray{Enter}')
    await user.type(
      within(form).getByLabelText('Add a collection by ID'),
      '3fa85f64-5717-4562-b3fc-2c963f66afa6{Enter}',
    )
    await user.type(
      within(form).getByLabelText('Web address'),
      'https://cdn.example.com/a.jpg',
    )
    await user.type(within(form).getByLabelText(/^SEO title/), 'Sushi tray SEO')
    await user.click(within(form).getByRole('button', { name: 'Add a metafield' }))
    await user.type(within(form).getByLabelText('Key'), 'material')
    await user.type(within(form).getByLabelText('Value'), 'PET')
    await user.click(submit(form))

    await waitFor(() => expect(create).toHaveBeenCalled())
    expect(create.mock.calls[0][0]).toMatchObject({
      vendor: 'Polymer',
      tags: ['eco', 'tray'],
      collections: ['3fa85f64-5717-4562-b3fc-2c963f66afa6'],
      media: [{ url: 'https://cdn.example.com/a.jpg', media_type: 'IMAGE' }],
      seo: { title: 'Sushi tray SEO' },
      metafields: [
        {
          namespace: 'custom',
          key: 'material',
          type: 'single_line_text_field',
          value: 'PET',
        },
      ],
    })
  }, 15_000)

  it('refuses a media address that is not https, and a collection that is not an ID', async () => {
    const { user, form } = await openForm()
    await fillBasics(user, form)
    await user.type(
      within(form).getByLabelText('Web address'),
      'http://insecure.example.com/a.jpg',
    )
    await user.type(within(form).getByLabelText('Add a collection by ID'), 'nope{Enter}')

    expect(
      await within(form).findByText('That is not a valid collection ID'),
    ).toBeInTheDocument()
    await user.click(submit(form))
    expect(
      await within(form).findByText('Use a public https:// address'),
    ).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })
})
