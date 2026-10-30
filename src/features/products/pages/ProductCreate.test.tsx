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
    access: { tags: vi.fn() },
    products: {
      list: vi.fn(),
      details: vi.fn(),
      create: vi.fn(),
      uploadTarget: vi.fn(),
      addMedia: vi.fn(),
      update: vi.fn(),
      syncHistory: vi.fn(),
    },
    auth: {},
  },
}))

// These tests type into a long form (all its steps are on the page) and run beside many other
// test files: allow for a slow machine, as the other Add product test files do.
vi.setConfig({ testTimeout: 20_000 })

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
    expect(form).toHaveClass('lg:min-h-full')
    // The form is the positioned box its visually hidden labels (sr-only) sit in. Without it they
    // are placed at the page's own edge and the whole page gets a second scrollbar.
    expect(form).toHaveClass('relative')
    expect(
      // The bar at the foot (the last Create product; the first is in the heading row).
      within(form).getAllByRole('button', { name: 'Create product' }).at(-1)!
        .parentElement,
    ).toHaveClass('lg:mt-auto')
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

  it('takes you to the first problem when Create is pressed, even far down the page', async () => {
    const { user, form } = await openForm()
    // A title is there, so the first problem is the price, further down the page.
    await user.type(within(form).getByLabelText('Title'), 'Sushi Tray')
    await user.click(submit(form))

    expect(await within(form).findByText('Enter a price')).toBeInTheDocument()
    expect(within(form).getByLabelText('Price')).toHaveFocus()
    expect(create).not.toHaveBeenCalled()
  })

  it('says what is wrong in a variant’s cell in words, with the variant it is about', async () => {
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
    await user.clear(within(form).getByLabelText('Price for Large'))
    await user.click(submit(form))

    expect(await within(form).findByText(/Price: Enter a price/)).toHaveTextContent(
      'Large · Price: Enter a price',
    )
    expect(within(form).getByLabelText('Price for Large')).toHaveFocus()
    expect(create).not.toHaveBeenCalled()
  }, 15_000)

  it('creates a product with every detail the form offers, and sends them all', async () => {
    locations.mockResolvedValue([{ id: 77, name: 'Warehouse', variants: 3 }])
    const COLLECTION = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
    const { user, form } = await openForm()
    // Pasting (one event) keeps this long form quick to fill; typing is tested field by field elsewhere.
    const type = async (label: string | RegExp, text: string) => {
      await user.click(within(form).getByLabelText(label))
      await user.paste(text)
    }

    // Basics: title, description, category, gift card (pictures are uploaded after creating).
    await type('Title', 'Hippo Bag')
    await user.click(await within(form).findByRole('button', { name: 'Edit HTML' }))
    await type('Description (HTML)', '<p>A roomy bag</p>')
    await type('Product category', 'gid://shopify/TaxonomyCategory/aa-1')
    await user.click(
      within(form).getByRole('checkbox', { name: 'This product is a gift card' }),
    )

    // The sidebar: status, type, vendor, collection, tags, theme template.
    await user.selectOptions(within(form).getByLabelText('Status'), 'Active')
    await type('Product type', 'Bags')
    await type('Vendor', 'Polymer')
    await type('Search collections', COLLECTION)
    await user.keyboard('{Enter}')
    await type('Add tags', 'eco, tray')
    await user.keyboard('{Enter}')
    await type('Theme template', 'gift')

    // Price & stock.
    await type('Price', '39.99')
    // The Price card's extra fields are behind its pills: the Compare-at pill opens them.
    await user.click(within(form).getByRole('button', { name: /^Compare-at/ }))
    await type('Compare-at price', '49.99')
    await type('Cost per item', '12.5')
    await type(/^Tax code/, 'P0000000')
    await user.click(
      within(form).getByRole('checkbox', { name: 'Charge tax on this product' }),
    )
    await user.selectOptions(
      await within(form).findByLabelText('Opening stock location'),
      'Warehouse',
    )
    await type('Opening stock', '12')
    await type('SKU (Stock Keeping Unit)', 'HB-1')
    await type('Barcode', '123456')
    await user.click(
      within(form).getByRole('checkbox', { name: 'Continue selling when out of stock' }),
    )

    // Shipping, search listing and a metafield.
    await type('Weight', '0.5')
    await type(/^SEO title/, 'Hippo Bag | Polymer')
    await type('SEO description', 'A roomy bag for everything.')
    await type('URL handle', 'hippo-bag')
    await user.click(within(form).getByRole('button', { name: 'Add a metafield' }))
    await type('Key', 'material')
    await type('Value', 'PET')

    await user.click(submit(form))

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    expect(create.mock.calls[0][0]).toEqual({
      shop: 'polymer-uk',
      title: 'Hippo Bag',
      description_html: expect.stringContaining('A roomy bag'),
      status: 'ACTIVE',
      gift_card: true,
      vendor: 'Polymer',
      product_type: 'Bags',
      handle: 'hippo-bag',
      tags: ['eco', 'tray'],
      seo: { title: 'Hippo Bag | Polymer', description: 'A roomy bag for everything.' },
      template_suffix: 'gift',
      category_gid: 'gid://shopify/TaxonomyCategory/aa-1',
      variants: [
        {
          price: '39.99',
          compare_at_price: '49.99',
          cost: '12.5',
          sku: 'HB-1',
          barcode: '123456',
          taxable: false,
          tax_code: 'P0000000',
          inventory_policy: 'CONTINUE',
          tracked: true,
          requires_shipping: true,
          weight: '0.5',
          weight_unit: 'KILOGRAMS',
          stock: [{ location_id: 77, available: 12 }],
        },
      ],
      collections: [COLLECTION],
      metafields: [
        {
          namespace: 'custom',
          key: 'material',
          type: 'single_line_text_field',
          value: 'PET',
        },
      ],
    })
  }, 60_000)

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

  it('sends the product category by name', async () => {
    const { user, form } = await openForm()
    await fillBasics(user, form)
    await user.click(within(form).getByLabelText('Product category'))
    await user.paste('Food Container Covers')
    await user.click(submit(form))

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    expect(create.mock.calls[0][0]).toMatchObject({
      category: 'Food Container Covers',
    })
    expect(create.mock.calls[0][0].category_gid).toBeUndefined()
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
    const { user, form } = await openForm()

    await user.click(within(form).getByRole('button', { name: 'Back to list' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Add product' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add product' }))
    const again = await screen.findByRole('region', { name: 'Add product' })
    await user.type(within(again).getByLabelText('Title'), 'Half done')
    await user.click(within(again).getByRole('button', { name: 'Back to list' }))
    // The app's own dialog asks (Keep editing is focused); keeping leaves the form as it was.
    const ask = await screen.findByRole('alertdialog', {
      name: 'Discard this new product?',
    })
    expect(within(ask).getByText('What you entered will be lost.')).toBeInTheDocument()
    expect(within(ask).getByRole('button', { name: 'Keep editing' })).toHaveFocus()
    await user.click(within(ask).getByRole('button', { name: 'Keep editing' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Add product' })).toBeInTheDocument()
    expect(within(again).getByLabelText('Title')).toHaveValue('Half done')

    await user.click(within(again).getByRole('button', { name: 'Back to list' }))
    await user.click(await screen.findByRole('button', { name: 'Yes, discard' }))
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
      const { user, form } = await openForm()

      // Nothing typed: closes at once.
      await user.click(within(strip()).getByRole('button', { name: 'Close New product' }))
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
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
      await user.click(
        within(
          await screen.findByRole('alertdialog', { name: 'Discard this new product?' }),
        ).getByRole('button', { name: 'Keep editing' }),
      )
      expect(screen.getByRole('region', { name: 'Add product' })).toBeInTheDocument()

      await user.click(within(strip()).getByRole('button', { name: 'Close New product' }))
      await user.click(await screen.findByRole('button', { name: 'Yes, discard' }))
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
  }, 15_000)

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

  it('sends tags, collections, SEO and metafields that were entered', async () => {
    const { user, form } = await openForm()
    await fillBasics(user, form)
    await user.type(within(form).getByLabelText(/^Vendor/), 'Polymer')
    await user.type(within(form).getByLabelText('Add tags'), 'eco, tray{Enter}')
    await user.type(
      within(form).getByLabelText('Search collections'),
      '3fa85f64-5717-4562-b3fc-2c963f66afa6{Enter}',
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

    it('sends a single product’s tax code, and no picture address (pictures are uploaded)', async () => {
      const { user, form } = await openForm()
      await fillBasics(user, form)
      // The single product has no "Image link" box any more: its pictures are uploaded.
      expect(within(form).queryByLabelText(/^Image link/)).toBeNull()
      await user.click(within(form).getByRole('button', { name: 'Show more options' }))
      await user.type(within(form).getByLabelText(/^Tax code/), 'P0000000')
      await user.click(submit(form))

      await waitFor(() => expect(create).toHaveBeenCalled())
      const body = create.mock.calls[0][0]
      expect(body.variants).toHaveLength(1)
      expect(body.variants[0]).toMatchObject({ tax_code: 'P0000000' })
      expect(body.variants[0]).not.toHaveProperty('image_url')
      expect(body).not.toHaveProperty('media')
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
      await user.type(within(form).getByLabelText('Image link for Small'), A)
      await user.type(within(form).getByLabelText('Image link for Large'), B)
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

    it('refuses a variant picture that is not an https address, and sends nothing', async () => {
      const { user, form } = await openForm()
      await fillBasics(user, form)
      await user.click(
        within(form).getByRole('button', { name: 'Add options like size or colour' }),
      )
      await user.type(within(form).getByLabelText('Option name'), 'Size')
      await user.type(
        within(form).getByLabelText('Add values for option 1'),
        'Small{Enter}',
      )
      await user.type(
        within(form).getByLabelText('Image link for Small'),
        'http://insecure.example.com/a.jpg',
      )
      await user.click(submit(form))

      expect(
        await within(form).findByText(/Use a public link that starts with https:\/\//),
      ).toBeInTheDocument()
      expect(create).not.toHaveBeenCalled()
    })
  })

  describe('files chosen from the computer', () => {
    const uploadTarget = vi.mocked(api.products.uploadTarget)
    const addMedia = vi.mocked(api.products.addMedia)
    const fetchMock = vi.fn()
    const TARGET = {
      uploadUrl: 'https://shopify-staged-uploads.storage.googleapis.com/',
      resourceUrl:
        'https://shopify-staged-uploads.storage.googleapis.com/tmp/1/photo.png',
      method: 'POST' as const,
      parameters: [{ name: 'key', value: 'tmp/1/photo.png' }],
    }
    const choose = (form: HTMLElement) =>
      within(form).getByLabelText('Choose files from your computer')

    beforeEach(() => {
      uploadTarget.mockResolvedValue(TARGET)
      addMedia.mockResolvedValue({
        product_id: 'new-id',
        sync_status: 'pending',
        push_id: 'p1',
        changes: {},
        message: 'Media queued for Shopify',
      })
      fetchMock.mockResolvedValue({ ok: true, status: 204 })
      vi.stubGlobal('fetch', fetchMock)
    })
    afterEach(() => {
      vi.unstubAllGlobals()
      fetchMock.mockReset()
    })

    it('lists the file, uploads nothing yet, and sends the product without it', async () => {
      const { user, form } = await openForm()
      await fillBasics(user, form)

      await user.upload(
        choose(form),
        new File(['pixels'], 'photo.png', { type: 'image/png' }),
      )

      expect(within(form).getByText('photo.png')).toBeInTheDocument()
      expect(
        within(form).getByText(/uploaded as soon as the product is created/),
      ).toBeInTheDocument()
      expect(uploadTarget).not.toHaveBeenCalled()
      await user.click(submit(form))
      await waitFor(() => expect(create).toHaveBeenCalled())
      // The file is not part of the create request: the product has to exist first.
      expect(create.mock.calls[0][0].media).toBeUndefined()
    })

    it('uploads the file to the new product right after it is created, then attaches it', async () => {
      const { user, form } = await openForm()
      await fillBasics(user, form)
      await user.upload(
        choose(form),
        new File(['pixels'], 'photo.png', { type: 'image/png' }),
      )
      await user.click(submit(form))

      await waitFor(() => expect(addMedia).toHaveBeenCalledTimes(1))
      expect(uploadTarget).toHaveBeenCalledWith(
        'new-id',
        {
          filename: 'photo.png',
          mime_type: 'image/png',
          size_bytes: 6,
          media_type: 'IMAGE',
        },
        'polymer-uk',
      )
      expect(fetchMock.mock.calls[0][0]).toBe(TARGET.uploadUrl)
      expect(addMedia).toHaveBeenCalledWith(
        'new-id',
        [{ url: TARGET.resourceUrl, media_type: 'IMAGE' }],
        'polymer-uk',
      )
      // The form was not held up by the upload: the page says it carries on in the background.
      expect(
        await screen.findByText(/1 file is uploading in the background/),
      ).toBeInTheDocument()
    })

    it('still creates the product when a file fails, without holding the form up', async () => {
      uploadTarget.mockRejectedValue(new ApiError('Storage is full.', { status: 500 }))
      const { user, form } = await openForm()
      await fillBasics(user, form)
      await user.upload(
        choose(form),
        new File(['pixels'], 'photo.png', { type: 'image/png' }),
      )
      await user.click(submit(form))

      // The product is created and the page moves on; the failure is on the file's own tile
      // in the product's Media tab (with a way to try again), not a message here.
      expect(await screen.findByText(/Created “Sushi Tray”/)).toBeInTheDocument()
      await waitFor(() => expect(uploadTarget).toHaveBeenCalled())
      expect(addMedia).not.toHaveBeenCalled()
    })

    it('counts a chosen file as something to lose when the form is closed', async () => {
      const { user, form } = await openForm()
      await user.upload(
        choose(form),
        new File(['pixels'], 'photo.png', { type: 'image/png' }),
      )

      await user.click(within(form).getByRole('button', { name: 'Back to list' }))

      expect(
        await screen.findByRole('alertdialog', { name: 'Discard this new product?' }),
      ).toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Add product' })).toBeInTheDocument()
    })
  })

  it('says so when a collection does not exist, and does not add it', async () => {
    const { user, form } = await openForm()
    await fillBasics(user, form)
    await user.type(within(form).getByLabelText('Search collections'), 'nope{Enter}')

    expect(
      await within(form).findByText('No collection is called “nope”'),
    ).toBeInTheDocument()
    expect(within(form).queryByRole('list', { name: 'Collections' })).toBeNull()
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

    it('also lists every tag of the chosen store from the tags API, asked only once the Tags box is used', async () => {
      seedKnown()
      const storeTags = vi.mocked(api.access.tags)
      storeTags.mockResolvedValue({
        tags: [
          {
            tag: 'b2b',
            label: 'B2B trade',
            is_lock_tag: true,
            products: 0,
            locked_products: 0,
            customers: 4,
          },
          {
            tag: 'Eco',
            label: null,
            is_lock_tag: false,
            products: 2,
            locked_products: 0,
            customers: 0,
          },
        ],
        page: 1,
        page_size: 200,
        total: 2,
        total_pages: 1,
        has_next: false,
      })
      const { user, form } = await openForm()
      // Nothing is asked until the box is clicked.
      expect(storeTags).not.toHaveBeenCalled()

      await user.click(within(form).getByLabelText('Add tags'))
      const choices = await screen.findByRole('listbox', { name: 'Matching tags' })

      // The API's tags and the ones seen on the loaded products, each once, A–Z.
      await waitFor(() =>
        expect(
          within(choices)
            .getAllByRole('option')
            .map((o) => o.textContent),
        ).toEqual(['b2b', 'Category_Food', 'Eco', 'Retail']),
      )
      expect(storeTags).toHaveBeenCalledWith({
        shop: expect.any(String),
        page: 1,
        page_size: 200,
      })
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
      const choices = await screen.findByRole('list', {
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
        await screen.findByText('Showing 1 of 120 — keep typing to narrow the list.'),
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
      expect(await screen.findByText('No collections found.')).toBeVisible()

      search.mockRejectedValue(new ApiError('Server error', { status: 500 }))
      await user.type(within(form).getByLabelText('Search collections'), 'zz')
      expect(
        await screen.findByText('Could not load the collections. Try again in a moment.'),
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

    it('has the compare-at price, cost per item and the continue-selling box in view, and sends them', async () => {
      const { user, form } = await openForm()
      await fillBasics(user, form)

      await user.click(within(form).getByRole('button', { name: 'Show more options' }))
      await user.type(within(form).getByLabelText('Compare-at price'), '12')
      await user.type(within(form).getByLabelText('Cost per item'), '3.5')
      await user.click(
        within(form).getByRole('checkbox', {
          name: 'Continue selling when out of stock',
        }),
      )
      await user.click(submit(form))

      await waitFor(() => expect(create).toHaveBeenCalled())
      expect(create.mock.calls[0][0].variants[0]).toMatchObject({
        compare_at_price: '12',
        cost: '3.5',
        inventory_policy: 'CONTINUE',
      })
    })

    it('shows the store’s currency symbol in front of the money boxes', async () => {
      const { user, form } = await openForm()
      await user.click(within(form).getByRole('button', { name: 'Show more options' }))
      // The first store is in pounds: Price, Compare-at price and Cost per item all say so.
      await waitFor(() =>
        expect(within(form).getAllByText('£').length).toBeGreaterThanOrEqual(3),
      )
    })

    it('works out Profit and Margin from the price and the cost as they are typed', async () => {
      const { user, form } = await openForm()
      await user.click(within(form).getByRole('button', { name: 'Show more options' }))
      const hint = () => within(form).getByText(/Customers never see/)
      expect(hint()).toHaveTextContent('What it costs you.')

      await user.type(within(form).getByLabelText('Price'), '40')
      await user.type(within(form).getByLabelText('Cost per item'), '10')

      await waitFor(() => expect(hint()).toHaveTextContent('Profit £30.00 · Margin 75%'))

      // A half-typed cost is no cost at all.
      await user.clear(within(form).getByLabelText('Cost per item'))
      await user.type(within(form).getByLabelText('Cost per item'), '1.')
      expect(hint()).toHaveTextContent('What it costs you.')
    })

    it('keeps the extra price fields closed until a pill or the chevron is pressed', async () => {
      const { user, form } = await openForm()
      const chevron = () =>
        within(form).getByRole('button', { name: /^(Show|Hide) more options$/ })

      // Closed to begin with: only the price box and the pills are there.
      expect(chevron()).toHaveAttribute('aria-expanded', 'false')
      expect(within(form).getByLabelText('Price')).toBeInTheDocument()
      expect(within(form).queryByLabelText('Compare-at price')).toBeNull()
      expect(within(form).queryByLabelText('Cost per item')).toBeNull()
      expect(within(form).queryByLabelText('Tax code')).toBeNull()
      expect(
        within(form).getByRole('button', { name: /^Charge taxs*Yes$/ }),
      ).toBeInTheDocument()

      // A pill opens it and puts the cursor in its own field.
      await user.click(within(form).getByRole('button', { name: 'Compare-at' }))
      expect(chevron()).toHaveAttribute('aria-expanded', 'true')
      await waitFor(() =>
        expect(within(form).getByLabelText('Compare-at price')).toHaveFocus(),
      )
      expect(within(form).getByLabelText('Tax code')).toBeInTheDocument()

      // The chevron closes it again, and opens it again.
      await user.click(chevron())
      expect(within(form).queryByLabelText('Compare-at price')).toBeNull()
      await user.click(within(form).getByRole('button', { name: 'Cost per item' }))
      await waitFor(() =>
        expect(within(form).getByLabelText('Cost per item')).toHaveFocus(),
      )

      // The Charge tax pill opens it too, and hides while the section is open.
      await user.click(chevron())
      await user.click(within(form).getByRole('button', { name: /^Charge tax/ }))
      expect(
        within(form).getByRole('checkbox', { name: 'Charge tax on this product' }),
      ).toBeChecked()
      expect(within(form).queryByRole('button', { name: /^Charge tax/ })).toBeNull()
    })

    it('shows what was typed in the pills, and keeps More details as its own section', async () => {
      const { user, form } = await openForm()
      await user.click(within(form).getByRole('button', { name: 'Show more options' }))
      await user.type(within(form).getByLabelText('Compare-at price'), '12')
      await user.click(
        within(form).getByRole('checkbox', { name: 'Charge tax on this product' }),
      )
      expect(
        within(form).getByRole('button', { name: /^Compare-ats*12$/ }),
      ).toBeInTheDocument()
      // While open, the Charge tax pill is hidden.
      expect(within(form).queryByRole('button', { name: /^Charge tax/ })).toBeNull()
      // Closing the options shows the Charge tax pill again.
      await user.click(within(form).getByRole('button', { name: 'Hide more options' }))
      expect(
        within(form).getByRole('button', { name: /^Charge taxs*No$/ }),
      ).toBeInTheDocument()

      const details = within(form).getByRole('button', { name: 'More details' })
      expect(details).toHaveAttribute('aria-expanded', 'true')
      await user.click(details)
      expect(within(form).queryByLabelText('SKU (Stock Keeping Unit)')).toBeNull()
      await user.click(details)
      expect(within(form).getByLabelText('SKU (Stock Keeping Unit)')).toBeInTheDocument()
    })

    it('opens a closed section again when a field in it has a problem', async () => {
      const { user, form } = await openForm()
      await fillBasics(user, form)
      await user.click(within(form).getByRole('button', { name: 'Show more options' }))
      await user.type(within(form).getByLabelText('Compare-at price'), 'abc')
      await user.click(within(form).getByRole('button', { name: 'Hide more options' }))
      expect(within(form).queryByLabelText('Compare-at price')).toBeNull()
      await user.click(submit(form))

      expect(
        await within(form).findByText(/Compare-at price: enter a number/),
      ).toBeInTheDocument()
      expect(
        within(form).getByRole('button', { name: 'Hide more options' }),
      ).toHaveAttribute('aria-expanded', 'true')
      expect(create).not.toHaveBeenCalled()
    })

    it('lays the opening stock out as a Location and Quantity table', async () => {
      locations.mockResolvedValue([{ id: 77, name: 'Warehouse', variants: 3 }])
      const { user, form } = await openForm()
      await user.selectOptions(
        await within(form).findByLabelText('Opening stock location'),
        'Warehouse',
      )
      await user.type(within(form).getByLabelText('Opening stock'), '12')

      expect(within(form).getByText('Location')).toBeInTheDocument()
      expect(within(form).getByText('Quantity')).toBeInTheDocument()
      expect(within(form).getByLabelText('Opening stock')).toHaveValue('12')
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
