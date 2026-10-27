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
    collections: { list: vi.fn() },
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

/** A `GET /collections` answer holding these rows. */
function collectionsPage(
  items: { id: string; title: string; handle?: string }[],
  total = items.length,
) {
  return {
    items: items.map((item) => ({
      handle: item.title.toLowerCase().replace(/ /g, '-'),
      collection_type: 'custom',
      editable: true,
      ...item,
    })),
    page: 1,
    page_size: 50,
    total,
    total_pages: 1,
    has_next: false,
  }
}

describe('adding a product', () => {
  beforeEach(() => {
    list.mockResolvedValue(page([EXISTING]))
    shopsList.mockResolvedValue(SHOPS)
    locations.mockResolvedValue([])
    create.mockResolvedValue(CREATED)
    vi.mocked(api.products.syncHistory).mockResolvedValue([])
    vi.mocked(api.collections.list).mockResolvedValue(collectionsPage([]))
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
    // The cards of the store admin's Add product page, in its order (no Publishing card).
    for (const name of [
      'Basics',
      'Pricing',
      'Inventory',
      'Shipping',
      'Variants',
      'Product metafields',
      'Search engine listing',
      'Product organization',
    ]) {
      expect(within(form).getByRole('region', { name })).toBeInTheDocument()
    }
    expect(within(form).getByRole('group', { name: 'Media' })).toBeInTheDocument()
    expect(within(form).queryByText(/Publishing/i)).not.toBeInTheDocument()
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
    expect(
      within(screen.getByLabelText('Product status')).getByRole('option', {
        name: 'All Products (2)',
      }),
    ).toBeInTheDocument()
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
    expect(within(form).getByRole('button', { name: 'Back to list' })).toBeDisabled()
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

    await user.click(within(form).getByRole('button', { name: 'Back to list' }))
    expect(confirm).not.toHaveBeenCalled()
    expect(screen.queryByRole('region', { name: 'Add product' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add product' }))
    const again = await screen.findByRole('region', { name: 'Add product' })
    await user.type(within(again).getByLabelText('Title'), 'Half done')
    await user.click(within(again).getByRole('button', { name: 'Back to list' }))
    expect(confirm).toHaveBeenCalled()
    expect(screen.getByRole('region', { name: 'Add product' })).toBeInTheDocument()

    confirm.mockReturnValue(true)
    await user.click(within(again).getByRole('button', { name: 'Back to list' }))
    expect(screen.queryByRole('region', { name: 'Add product' })).not.toBeInTheDocument()
  })

  describe('as a tab', () => {
    const strip = () => screen.getByRole('navigation', { name: 'Open products' })

    it('opens in a tab of its own beside the opened products, like View product', async () => {
      const { form } = await openForm()

      const tab = within(strip()).getByRole('button', { name: /^Product\s*New product$/ })
      expect(tab).toHaveAttribute('aria-current', 'page')
      expect(
        within(strip()).getByRole('button', { name: 'All Products' }),
      ).not.toHaveAttribute('aria-current')
      expect(form.closest('.hidden')).toBeNull()
    })

    it('keeps what was typed while another tab shows, and comes back to it', async () => {
      const { user, form } = await openForm()
      await user.type(within(form).getByLabelText('Title'), 'Half done')

      await user.click(within(strip()).getByRole('button', { name: 'All Products' }))
      // Hidden (Tailwind's `hidden`), not unmounted.
      expect(form.closest('.hidden')).not.toBeNull()
      expect(
        screen.getByRole('region', { name: 'Products' }).closest('.hidden'),
      ).toBeNull()

      await user.click(
        within(strip()).getByRole('button', { name: /^Product\s*New product$/ }),
      )
      expect(form.closest('.hidden')).toBeNull()
      expect(within(form).getByLabelText('Title')).toHaveValue('Half done')
    })

    it('closing the tab asks first when something was typed, and removes it', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
      const { user, form } = await openForm()

      // Nothing typed: closes at once.
      await user.click(within(strip()).getByRole('button', { name: 'Close New product' }))
      expect(confirm).not.toHaveBeenCalled()
      expect(
        screen.queryByRole('region', { name: 'Add product' }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('navigation', { name: 'Open products' }),
      ).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Add product' }))
      const again = await screen.findByRole('region', { name: 'Add product' })
      await user.type(within(again).getByLabelText('Title'), 'Half done')
      await user.click(within(strip()).getByRole('button', { name: 'Close New product' }))
      expect(confirm).toHaveBeenCalled()
      expect(screen.getByRole('region', { name: 'Add product' })).toBeInTheDocument()

      confirm.mockReturnValue(true)
      await user.click(within(strip()).getByRole('button', { name: 'Close New product' }))
      expect(
        screen.queryByRole('region', { name: 'Add product' }),
      ).not.toBeInTheDocument()
      void form
    })

    it('goes away once the product is created', async () => {
      const { user, form } = await openForm()
      await fillBasics(user, form)
      await user.click(submit(form))

      await screen.findByText(/Created/)
      expect(
        screen.queryByRole('region', { name: 'Add product' }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('navigation', { name: 'Open products' }),
      ).not.toBeInTheDocument()
    })
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
      within(form).getByLabelText('Search collections'),
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

  it('says what the store made — the variant and file counts it reports', async () => {
    create.mockResolvedValue({ ...CREATED, variants: 2, media: 3 })
    const { user, form } = await openForm()
    await fillBasics(user, form)
    await user.click(submit(form))

    expect(
      await screen.findByText(/Created “Sushi Tray” with 2 variants and 3 files./),
    ).toBeInTheDocument()
  })

  it('gives each variant its own weight, in one shared unit', async () => {
    const { user, form } = await openForm()
    await fillBasics(user, form)
    await user.click(
      within(form).getByRole('button', { name: 'Add options like size or colour' }),
    )
    await user.type(within(form).getByLabelText('Option name'), 'Size')
    await user.type(
      within(form).getByLabelText('Add values for option 1'),
      'Small, Large{Enter}',
    )
    await user.type(within(form).getByLabelText('Weight for Small'), '0.10')
    await user.type(within(form).getByLabelText('Weight for Large'), '0.15')
    await user.click(submit(form))

    await waitFor(() => expect(create).toHaveBeenCalled())
    expect(
      create.mock.calls[0][0].variants.map((v) => [v.weight, v.weight_unit]),
    ).toEqual([
      ['0.10', 'KILOGRAMS'],
      ['0.15', 'KILOGRAMS'],
    ])
  }, 15_000)

  describe('variant pictures and the tax code', () => {
    const A = 'https://cdn.example.com/a.jpg'
    const B = 'https://cdn.example.com/b.jpg'

    it('sends a single product its picture address, listing it in media too, and the tax code', async () => {
      const { user, form } = await openForm()
      await fillBasics(user, form)
      await user.type(within(form).getByLabelText(/^Picture address/), A)
      // The tax code sits behind the Price card's "Charge tax" pill.
      await user.click(within(form).getByRole('button', { name: /^Charge tax/ }))
      await user.type(within(form).getByLabelText(/^Tax code/), 'P0000000')
      await user.click(submit(form))

      await waitFor(() => expect(create).toHaveBeenCalled())
      const body = create.mock.calls[0][0]
      expect(body.variants).toHaveLength(1)
      expect(body.variants[0]).toMatchObject({ image_url: A, tax_code: 'P0000000' })
      expect(body.media).toEqual([{ url: A, media_type: 'IMAGE' }])
    }, 15_000)

    it('gives each variant of a multi-variant product its own picture address', async () => {
      const { user, form } = await openForm()
      await fillBasics(user, form)
      await user.click(
        within(form).getByRole('button', { name: 'Add options like size or colour' }),
      )
      await user.type(within(form).getByLabelText('Option name'), 'Size')
      await user.type(
        within(form).getByLabelText('Add values for option 1'),
        'Small, Large{Enter}',
      )
      await user.type(within(form).getByLabelText('Picture address for Small'), A)
      await user.type(within(form).getByLabelText('Picture address for Large'), B)
      await user.click(submit(form))

      await waitFor(() => expect(create).toHaveBeenCalled())
      const body = create.mock.calls[0][0]
      expect(body.variants.map((v) => [v.option_values, v.image_url])).toEqual([
        [['Small'], A],
        [['Large'], B],
      ])
      // Every variant picture is in media, as the API requires.
      expect(body.media?.map((item) => item.url)).toEqual([A, B])
    }, 15_000)

    it('suggests the addresses already listed under Media', async () => {
      const { user, form } = await openForm()
      await user.type(within(form).getByLabelText('Web address'), A)

      const suggestions = form.querySelector('datalist#create-variant-pictures')
      expect(suggestions?.querySelectorAll('option')).toHaveLength(1)
      expect(suggestions?.querySelector('option')?.value).toBe(A)
    })

    it('refuses a variant picture that is not an https address, and sends nothing', async () => {
      const { user, form } = await openForm()
      await fillBasics(user, form)
      await user.type(
        within(form).getByLabelText(/^Picture address/),
        'http://insecure.example.com/a.jpg',
      )
      await user.click(submit(form))

      expect(
        await within(form).findByText('Use a public https:// address'),
      ).toBeInTheDocument()
      expect(create).not.toHaveBeenCalled()
    })
  })

  it('refuses a media address that is not https, and a collection that does not exist', async () => {
    const { user, form } = await openForm()
    await fillBasics(user, form)
    await user.type(
      within(form).getByLabelText('Web address'),
      'http://insecure.example.com/a.jpg',
    )
    await user.type(within(form).getByLabelText('Search collections'), 'nope{Enter}')

    expect(
      await within(form).findByText('No collection is called “nope”'),
    ).toBeInTheDocument()
    await user.click(submit(form))
    expect(
      await within(form).findByText('Use a public https:// address'),
    ).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  describe('the store admin Add product design', () => {
    const WHOLESALE = '11111111-1111-4111-8111-111111111111'
    const RETAIL = '22222222-2222-4222-8222-222222222222'
    const SMART = '33333333-3333-4333-8333-333333333333'

    function seedKnown() {
      list.mockResolvedValue(
        page([{ ...EXISTING, tags: ['Category_Food', 'Retail', 'Eco'] }]),
      )
      vi.mocked(api.products.details).mockResolvedValue({
        id: 'id-1',
        handle: 'hippo-bag',
        title: 'Hippo Bag',
        collections: [
          {
            id: WHOLESALE,
            title: 'Wholesale',
            handle: 'wholesale',
            collection_type: 'CUSTOM',
          },
          {
            id: RETAIL,
            title: 'Retail bags',
            handle: 'retail-bags',
            collection_type: 'CUSTOM',
          },
          {
            id: SMART,
            title: 'Auto bags',
            handle: 'auto-bags',
            collection_type: 'SMART',
          },
        ],
      } as never)
    }

    it('lists every existing tag as soon as the Tags box is clicked, and narrows as you type', async () => {
      seedKnown()
      const { user, form } = await openForm()

      await user.click(within(form).getByLabelText('Add tags'))
      const choices = await screen.findByRole('listbox', { name: 'Matching tags' })
      expect(
        within(choices)
          .getAllByRole('option')
          .map((o) => o.textContent),
      ).toEqual(['Category_Food', 'Eco', 'Retail'])

      await user.click(within(choices).getByRole('option', { name: 'Eco' }))
      expect(within(form).getByRole('list', { name: 'Tags' })).toHaveTextContent('Eco')
      // The picked one leaves the list, the others stay (it is still open for the next).
      const again = await screen.findByRole('listbox', { name: 'Matching tags' })
      expect(within(again).queryByRole('option', { name: 'Eco' })).not.toBeInTheDocument()
      expect(within(again).getAllByRole('option')).toHaveLength(2)

      await user.type(within(form).getByLabelText('Add tags'), 'ret')
      expect(
        within(
          await screen.findByRole('listbox', { name: 'Matching tags' }),
        ).getAllByRole('option'),
      ).toHaveLength(1)
    })

    it('lists the store’s collections from the backend when the Collections box is clicked, and sends the picked ones', async () => {
      const search = vi.mocked(api.collections.list)
      search.mockResolvedValue(
        collectionsPage([
          { id: RETAIL, title: 'Retail bags' },
          { id: WHOLESALE, title: 'Wholesale' },
        ]),
      )
      const { user, form } = await openForm()
      // Nothing is asked until the box is opened.
      expect(search).not.toHaveBeenCalled()

      await user.click(within(form).getByLabelText('Search collections'))
      const choices = await within(form).findByRole('list', {
        name: 'Collections to add',
      })
      await within(choices).findByRole('button', { name: 'Retail bags' })
      expect(
        within(choices).getByRole('button', { name: 'Wholesale' }),
      ).toBeInTheDocument()
      // The store's manual collections, first page by title, for the store the product goes to.
      expect(search).toHaveBeenCalledWith({
        type: 'custom',
        sort: 'title',
        order: 'asc',
        page_size: 50,
        shop: 'polymer-uk',
      })

      await user.click(within(choices).getByRole('button', { name: 'Wholesale' }))
      expect(within(form).getByRole('list', { name: 'Collections' })).toHaveTextContent(
        'Wholesale',
      )
      expect(
        within(form).getByRole('button', { name: 'Remove collection Wholesale' }),
      ).toBeInTheDocument()
      // The picked one leaves the list, the other stays.
      expect(
        within(choices).queryByRole('button', { name: 'Wholesale' }),
      ).not.toBeInTheDocument()

      await fillBasics(user, form)
      await user.click(submit(form))
      await waitFor(() => expect(create).toHaveBeenCalled())
      expect(create.mock.calls[0][0].collections).toEqual([WHOLESALE])
    })

    it('searches the backend as you type, says how many more there are, and adds by name on Enter', async () => {
      const search = vi.mocked(api.collections.list)
      search.mockImplementation(async (params) =>
        params.search
          ? collectionsPage([{ id: RETAIL, title: 'Retail bags' }])
          : collectionsPage([{ id: WHOLESALE, title: 'Wholesale' }], 120),
      )
      const { user, form } = await openForm()

      await user.click(within(form).getByLabelText('Search collections'))
      expect(
        await within(form).findByText(
          'Showing 1 of 120 — keep typing to narrow the list.',
        ),
      ).toBeVisible()

      await user.type(
        within(form).getByLabelText('Search collections'),
        'retail BAGS{Enter}',
      )

      expect(
        await within(form).findByRole('button', {
          name: 'Remove collection Retail bags',
        }),
      ).toBeInTheDocument()
      expect(search).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'retail BAGS' }),
      )
    })

    it('says so when the backend has no collections, or the search fails', async () => {
      const search = vi.mocked(api.collections.list)
      const { user, form } = await openForm()

      await user.click(within(form).getByLabelText('Search collections'))
      expect(await within(form).findByText('No collections found.')).toBeVisible()

      search.mockRejectedValue(new ApiError('Server error', { status: 500 }))
      await user.type(within(form).getByLabelText('Search collections'), 'zz')
      expect(
        await within(form).findByText(
          'Could not load the collections. Try again in a moment.',
        ),
      ).toBeVisible()
    })

    it('Inventory tracked and Physical product are switches that are sent', async () => {
      const { user, form } = await openForm()
      await fillBasics(user, form)
      const tracked = within(form).getByRole('switch', { name: 'Inventory tracked' })
      const physical = within(form).getByRole('switch', { name: 'Physical product' })
      expect(tracked).toBeChecked()
      expect(physical).toBeChecked()

      await user.click(tracked)
      await user.click(physical)
      expect(within(form).queryByLabelText('Opening stock location ID')).toBeNull()
      expect(within(form).queryByLabelText('Weight')).toBeNull()
      await user.click(submit(form))

      await waitFor(() => expect(create).toHaveBeenCalled())
      expect(create.mock.calls[0][0].variants[0]).toMatchObject({
        tracked: false,
        requires_shipping: false,
      })
    })

    it('opens Compare-at, Cost per item and the other price fields from the card pills', async () => {
      const { user, form } = await openForm()
      await fillBasics(user, form)
      expect(within(form).queryByLabelText('Compare-at price')).toBeNull()

      await user.click(within(form).getByRole('button', { name: 'Compare-at' }))
      await user.type(within(form).getByLabelText('Compare-at price'), '12')
      await user.type(within(form).getByLabelText('Cost per item'), '3.5')
      // Sell when out of stock is a pill that switches straight over.
      await user.click(
        within(form).getByRole('button', { name: /^Sell when out of stock/ }),
      )
      await user.click(submit(form))

      await waitFor(() => expect(create).toHaveBeenCalled())
      expect(create.mock.calls[0][0].variants[0]).toMatchObject({
        compare_at_price: '12',
        cost: '3.5',
        inventory_policy: 'CONTINUE',
      })
    })

    it('folds an option into a summary with Done, and removes it with Delete', async () => {
      const { user, form } = await openForm()
      await user.click(
        within(form).getByRole('button', { name: 'Add options like size or colour' }),
      )
      await user.type(within(form).getByLabelText('Option name'), 'Size')
      await user.type(
        within(form).getByLabelText('Add values for option 1'),
        'Small, Large{Enter}',
      )
      await user.click(within(form).getByRole('button', { name: 'Done' }))

      // Folded: the inputs are gone, the name and values show, and it opens again on click.
      expect(within(form).queryByLabelText('Option name')).toBeNull()
      const summary = within(form).getByRole('button', { name: 'Edit option Size' })
      expect(summary).toHaveTextContent('Small')
      expect(summary).toHaveTextContent('Large')
      expect(within(form).getByLabelText('Price for Small')).toBeInTheDocument()

      await user.click(summary)
      await user.click(within(form).getByRole('button', { name: 'Remove option 1' }))
      expect(within(form).queryByLabelText('Price for Small')).toBeNull()
      expect(
        within(form).getByRole('button', { name: 'Add options like size or colour' }),
      ).toBeInTheDocument()
    })
  })
})
