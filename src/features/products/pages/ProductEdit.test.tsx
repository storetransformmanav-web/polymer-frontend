import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api/ApiError.ts'
import {
  api,
  type ProductDetail,
  type ProductListItem,
  type ProductListResponse,
  type ProductWriteResult,
} from '../../../lib/api/endpoints.ts'
import { confirmUpdate } from '../../../test/confirmUpdate.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { ProductsPage } from './ProductsPage.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    products: {
      list: vi.fn(),
      details: vi.fn(),
      update: vi.fn(),
      push: vi.fn(),
      syncHistory: vi.fn(),
    },
    collections: {
      list: vi.fn(),
      create: vi.fn(),
    },
    inventory: {
      locations: vi.fn(),
    },
    auth: {},
  },
}))

const VARIANT = '11111111-1111-4111-8111-111111111111'
const IMAGE_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const IMAGE_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const SHOP = {
  key: 'polymer-uk',
  name: 'Polymer UK',
  domain: 'polymer-uk-ltd.myshopify.com',
  currency: 'GBP',
}

const ROW: ProductListItem = {
  shop: SHOP,
  id: 'id-1',
  shopify_id: 1,
  title: 'Hippo Bag',
  handle: 'hippo-bag',
  status: 'ACTIVE',
  vendor: 'Polymer',
  product_type: 'Bags',
  category_name: null,
  tags: ['modern'],
  image_url: null,
  price_min: '25.85',
  price_max: '25.85',
  currency: 'GBP',
  variants_count: 1,
  total_inventory: 5,
  shopify_created_at: null,
  shopify_updated_at: null,
  synced_at: '2026-01-01T00:00:00Z',
}

const DETAIL = {
  shop: SHOP,
  id: 'id-1',
  shopify_id: 1,
  title: 'Hippo Bag',
  handle: 'hippo-bag',
  description_html: '<p>Strong</p>',
  status: 'ACTIVE',
  vendor: 'Polymer',
  product_type: 'Bags',
  category: null,
  tags: ['modern'],
  template_suffix: '',
  has_only_default_variant: true,
  has_out_of_stock_variants: false,
  total_inventory: 5,
  tracks_inventory: true,
  requires_selling_plan: false,
  gift_card: false,
  seo: { title: 'Hippo SEO', description: null },
  online_store_url: null,
  currency: 'GBP',
  price_range: { min: '25.85', max: '25.85', currency: 'GBP' },
  compare_at_price_range: null,
  featured_image_url: null,
  variants_count: 1,
  media_count: 2,
  published_at: null,
  shopify_created_at: null,
  shopify_updated_at: null,
  synced_at: '2026-01-01T00:00:00Z',
  options: [{ name: 'Size', position: 1, values: ['M'] }],
  images: [
    {
      id: IMAGE_1,
      url: 'https://cdn.example.com/1.jpg',
      alt_text: 'One',
      position: 1,
      media_type: 'IMAGE',
    },
    {
      id: IMAGE_2,
      url: 'https://cdn.example.com/2.jpg',
      alt_text: 'Two',
      position: 2,
      media_type: 'IMAGE',
    },
  ],
  variants: [
    {
      id: VARIANT,
      shopify_id: 1,
      title: 'M',
      sku: 'SKU-1',
      barcode: '',
      price: '25.85',
      currency: 'GBP',
      weight: '100',
      weight_unit: 'GRAMS',
      taxable: true,
      requires_shipping: true,
      inventory_policy: 'DENY',
      inventory_management: 'SHOPIFY',
      inventory_levels: [],
      metafields: [],
    },
  ],
  collections: [
    {
      id: 'col1',
      shopify_id: 1,
      title: 'Best Sellers',
      handle: 'best-sellers',
      collection_type: 'smart',
    },
  ],
  metafields: [],
} as unknown as ProductDetail

const LIST: ProductListResponse = {
  items: [ROW],
  page: 1,
  page_size: 25,
  total: 1,
  total_pages: 1,
  has_next: false,
  sort: 'created_at',
  order: 'desc',
}

const WRITE_OK: ProductWriteResult = {
  product_id: 'id-1',
  sync_status: 'pending',
  push_id: 'push-1',
  changes: { title: 'x' },
  message: 'Saved. Sending to the store.',
}

const list = vi.mocked(api.products.list)
const details = vi.mocked(api.products.details)
const update = vi.mocked(api.products.update)
const push = vi.mocked(api.products.push)
const syncHistory = vi.mocked(api.products.syncHistory)

function renderPage(route = '/products') {
  return renderWithProviders(
    <Routes>
      <Route path="/products/*" element={<ProductsPage />} />
    </Routes>,
    { route },
  )
}

const never = () => new Promise<never>(() => undefined)

const NEW_COLLECTION = {
  id: '2ac9d27a-77c2-43e7-8790-796c094c9111',
  shopify_id: 694879420801,
  title: 'Juice Bottles',
  handle: 'juice-bottles',
  collection_type: 'custom',
  editable: true,
  products_count: 1,
  products: [],
}

describe('editing a product', () => {
  beforeEach(() => {
    list.mockResolvedValue(LIST)
    details.mockResolvedValue(DETAIL)
    update.mockResolvedValue(WRITE_OK)
    syncHistory.mockResolvedValue([])
    vi.mocked(api.inventory.locations).mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('opening', () => {
    it('has only View in every row under an Actions column — no Edit pencil, and Delete is hidden for now', async () => {
      renderPage()
      await screen.findByText('Hippo Bag')

      expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'View Hippo Bag' })).toBeInTheDocument()
      // Temporarily hidden (utils/flags.ts → SHOW_PRODUCT_DELETE).
      expect(
        screen.queryByRole('button', { name: 'Delete Hippo Bag' }),
      ).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Delete / })).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Edit Hippo Bag' }),
      ).not.toBeInTheDocument()
    })

    it('has no global Edit button on the details page — sections edit in place instead', async () => {
      renderPage('/products/id-1')
      await screen.findByRole('heading', { level: 1, name: 'Hippo Bag' })

      expect(
        screen.queryByRole('button', { name: 'Edit product' }),
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Edit specifications' }),
      ).toBeInTheDocument()
    })
  })

  describe('sending to the store', () => {
    async function saveFromDetails(user: ReturnType<typeof userEvent.setup>) {
      renderPage('/products/id-1')
      await screen.findByRole('heading', { level: 1, name: 'Hippo Bag' })
      await user.click(screen.getByRole('button', { name: 'Edit specifications' }))
      await user.type(screen.getByLabelText('Vendor'), ' Ltd')
      await user.click(screen.getByRole('button', { name: 'Save specifications' }))
      await confirmUpdate(user)
      await waitFor(() =>
        expect(
          screen.queryByRole('button', { name: 'Save specifications' }),
        ).not.toBeInTheDocument(),
      )
    }

    it('shows that the edit is on its way, and then that it arrived', async () => {
      const user = userEvent.setup()
      await saveFromDetails(user)

      expect(await screen.findByText('Sending to the store…')).toBeInTheDocument()
      expect(syncHistory).toHaveBeenCalledWith('id-1', 'polymer-uk', 1)

      syncHistory.mockResolvedValue([
        {
          id: 'push-1',
          action: 'update',
          status: 'success',
          attempts: 1,
          created_at: '2026-10-15T10:00:00Z',
          finished_at: '2026-10-15T10:00:03Z',
        },
      ])
      // The next poll picks the finished push up (the page polls while it is in progress).
      expect(
        await screen.findByText('Sent to the store', {}, { timeout: 6000 }),
      ).toBeInTheDocument()
    }, 15000)

    it('says when the push failed, and retries it', async () => {
      syncHistory.mockResolvedValue([
        {
          id: 'push-1',
          action: 'update',
          status: 'failed',
          attempts: 1,
          error: 'Shopify rejected the handle',
          created_at: '2026-10-15T10:00:00Z',
          finished_at: null,
        },
      ])
      push.mockResolvedValue({ ...WRITE_OK, sync_status: 'pending' })
      const user = userEvent.setup()
      await saveFromDetails(user)

      expect(await screen.findByText('Not sent to the store')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Retry' }))

      await waitFor(() => expect(push).toHaveBeenCalledWith('id-1', 'polymer-uk'))
    })

    it('does not ask for any push history just because a product was viewed', async () => {
      renderPage('/products/id-1')
      await screen.findByRole('heading', { level: 1, name: 'Hippo Bag' })

      expect(syncHistory).not.toHaveBeenCalled()
      expect(screen.queryByText('Sync History')).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Sync product' }),
      ).not.toBeInTheDocument()
    })
  })
})

describe('editing a section in place', () => {
  beforeEach(() => {
    list.mockResolvedValue(LIST)
    details.mockResolvedValue(DETAIL)
    update.mockResolvedValue(WRITE_OK)
    syncHistory.mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  async function openDetails() {
    const user = userEvent.setup()
    renderPage('/products/id-1')
    await screen.findByRole('heading', { level: 1, name: 'Hippo Bag' })
    return user
  }
  const pencil = (what: string) => screen.getByRole('button', { name: `Edit ${what}` })
  const saveButton = (what: string) =>
    screen.getByRole('button', { name: `Save ${what}` })
  const discardButton = (what: string) =>
    screen.getByRole('button', { name: `Discard ${what} changes` })

  it('gives every section its own pencil, and opens no dialog', async () => {
    const user = await openDetails()

    for (const what of ['specifications', 'description']) {
      expect(pencil(what)).toBeInTheDocument()
    }
    // There is no Status & Launch card any more (the list's status dropdown changes it).
    expect(screen.queryByRole('button', { name: 'Edit status' })).toBeNull()
    await user.click(pencil('specifications'))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // The fields appear right where the section is.
    expect(screen.getByLabelText('Title')).toHaveValue('Hippo Bag')
  })

  it('turns the pencil into Save and Discard, and only for the section being edited', async () => {
    const user = await openDetails()
    await user.click(pencil('specifications'))

    expect(saveButton('specifications')).toBeInTheDocument()
    expect(discardButton('specifications')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Edit specifications' }),
    ).not.toBeInTheDocument()
    // Everything else stays read-only: its pencil is still there and no editor is open.
    expect(pencil('description')).toBeInTheDocument()
    expect(screen.queryByLabelText('Description')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument()
  })

  it('names the icons "Edit", "Save" and "Discard" in tooltips', async () => {
    const user = await openDetails()
    expect(
      screen.getAllByRole('tooltip', { hidden: true }).map((t) => t.textContent),
    ).toContain('Edit')

    await user.click(pencil('specifications'))
    await user.hover(saveButton('specifications'))

    const tips = screen
      .getAllByRole('tooltip', { hidden: true })
      .map((tip) => tip.textContent)
    expect(tips).toContain('Save')
    expect(tips).toContain('Discard')
  })

  it('keeps Save disabled until something changes', async () => {
    const user = await openDetails()
    await user.click(pencil('specifications'))

    expect(saveButton('specifications')).toBeDisabled()
    await user.type(screen.getByLabelText('Vendor'), '!')
    expect(saveButton('specifications')).toBeEnabled()
  })

  it('saves only that section, in place, and confirms', async () => {
    const user = await openDetails()
    await user.click(pencil('specifications'))
    const title = screen.getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'Hippo Carrier Bag')
    await user.click(saveButton('specifications'))
    await confirmUpdate(user)

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { title: 'Hippo Carrier Bag' },
        'polymer-uk',
      ),
    )
    // Back to read-only.
    await waitFor(() => expect(pencil('specifications')).toBeInTheDocument())
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
    expect(await screen.findByText(/Saved “Hippo Carrier Bag”/)).toBeInTheDocument()
  })

  it('offers to redirect the old address only once the handle is changed, and sends the choice', async () => {
    const user = await openDetails()
    await user.click(pencil('specifications'))
    const redirect = () =>
      screen.queryByRole('checkbox', { name: 'Redirect the old address to the new one' })
    expect(redirect()).toBeNull()

    const handle = screen.getByLabelText('Handle')
    await user.clear(handle)
    await user.type(handle, 'hippo-carrier-bag')
    // On to begin with.
    expect(redirect()).toBeChecked()
    await user.click(redirect()!)
    await user.click(saveButton('specifications'))
    await confirmUpdate(user)

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { handle: 'hippo-carrier-bag', redirect_new_handle: false },
        'polymer-uk',
      ),
    )
  })

  it('sends the category by name', async () => {
    const user = await openDetails()
    await user.click(pencil('specifications'))
    await user.type(screen.getByLabelText(/^Category/), 'Food Container Covers')
    await user.click(saveButton('specifications'))
    await confirmUpdate(user)

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { category: 'Food Container Covers' },
        'polymer-uk',
      ),
    )
  })

  describe('asking "are you sure?" before a save', () => {
    async function startEditingVendor() {
      const user = await openDetails()
      await user.click(pencil('specifications'))
      await user.type(screen.getByLabelText('Vendor'), ' Ltd')
      await user.click(saveButton('specifications'))
      const dialog = await screen.findByRole('alertdialog', {
        name: 'Update “Hippo Bag”?',
      })
      return { user, dialog }
    }

    it('says the change also goes to Shopify, and sends nothing until "Yes, update"', async () => {
      const { user, dialog } = await startEditingVendor()

      expect(
        within(dialog).getByText('Are you sure you want to update this?'),
      ).toBeInTheDocument()
      expect(within(dialog).getByText(/also be updated in Shopify/)).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
      expect(update).not.toHaveBeenCalled()

      await user.click(within(dialog).getByRole('button', { name: 'Yes, update' }))

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'id-1',
          expect.objectContaining({ vendor: expect.stringContaining('Ltd') }),
          'polymer-uk',
        ),
      )
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    it('keeps everything typed and sends nothing on Cancel', async () => {
      const { user, dialog } = await startEditingVendor()

      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(update).not.toHaveBeenCalled()
      // Still editing, with the typed text, ready to save again or discard.
      expect(screen.getByLabelText('Vendor')).toHaveValue('Polymer Ltd')
      expect(saveButton('specifications')).toBeEnabled()
    })

    it('closes on Escape without discarding the edit or sending anything', async () => {
      const { user } = await startEditingVendor()

      await user.keyboard('{Escape}')

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(update).not.toHaveBeenCalled()
      expect(screen.getByLabelText('Vendor')).toHaveValue('Polymer Ltd')
    })

    it('does not ask while a field is invalid — the problem is shown instead', async () => {
      const user = await openDetails()
      await user.click(pencil('specifications'))
      await user.clear(screen.getByLabelText('Title'))
      await user.click(saveButton('specifications'))

      expect(screen.getByText('Enter a title')).toBeInTheDocument()
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(update).not.toHaveBeenCalled()
    })
  })

  it('throws the changes away on Discard, without asking the server anything', async () => {
    const user = await openDetails()
    await user.click(pencil('specifications'))
    await user.type(screen.getByLabelText('Vendor'), ' Ltd')

    await user.click(discardButton('specifications'))

    expect(pencil('specifications')).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
    // Editing again starts from the saved values, not the abandoned draft.
    await user.click(pencil('specifications'))
    expect(screen.getByLabelText('Vendor')).toHaveValue('Polymer')
  })

  it('also discards on Escape', async () => {
    const user = await openDetails()
    await user.click(pencil('specifications'))
    await user.type(screen.getByLabelText('Vendor'), ' Ltd')

    await user.keyboard('{Escape}')

    expect(pencil('specifications')).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
  })

  it('edits the description and the search listing as separate saves', async () => {
    const user = await openDetails()

    await user.click(pencil('description'))
    // The rich-text editor loads on demand; its raw HTML view is a plain text box.
    await user.click(await screen.findByRole('button', { name: 'Edit HTML' }))
    const description = screen.getByLabelText('Description (HTML)')
    await user.clear(description)
    await user.type(description, 'Brand new copy')
    await user.click(saveButton('description'))
    await confirmUpdate(user)
    await waitFor(() =>
      expect(update).toHaveBeenLastCalledWith(
        'id-1',
        { description_html: 'Brand new copy' },
        'polymer-uk',
      ),
    )

    await user.click(screen.getByRole('tab', { name: /^SEO & Online/ }))
    await user.click(pencil('search listing'))
    const seoTitle = screen.getByLabelText(/^SEO title/)
    await user.clear(seoTitle)
    await user.type(seoTitle, 'Hippo carrier bag')
    await user.click(saveButton('search listing'))
    await confirmUpdate(user)
    await waitFor(() =>
      expect(update).toHaveBeenLastCalledWith(
        'id-1',
        { seo: { title: 'Hippo carrier bag', description: '' } },
        'polymer-uk',
      ),
    )
    expect(update).toHaveBeenCalledTimes(2)
  })

  it('edits two sections at once without one touching the other', async () => {
    const user = await openDetails()
    await user.click(pencil('specifications'))
    await user.click(pencil('description'))
    await user.click(await screen.findByRole('button', { name: 'Edit HTML' }))
    await user.type(screen.getByLabelText('Description (HTML)'), ' — extra')

    await user.type(screen.getByLabelText('Vendor'), ' Ltd')
    await user.click(saveButton('specifications'))
    await confirmUpdate(user)

    // Only the vendor went; the half-typed description is still an open draft.
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { vendor: 'Polymer Ltd' },
        'polymer-uk',
      ),
    )
    expect(saveButton('description')).toBeEnabled()
  })

  it('checks only its own fields: a blank title blocks the specifications, nothing else', async () => {
    const user = await openDetails()
    await user.click(pencil('specifications'))
    await user.clear(screen.getByLabelText('Title'))
    await user.click(saveButton('specifications'))
    await confirmUpdate(user)

    expect(screen.getByText('Enter a title')).toBeInTheDocument()
    expect(screen.getByText('Fix the highlighted fields to save.')).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
    // Still editing, with the problem shown in place.
    expect(discardButton('specifications')).toBeInTheDocument()
  })

  it("shows the backend's message in the section and stays in edit mode when saving fails", async () => {
    update.mockRejectedValue(
      new ApiError('A product with this handle already exists.', { status: 422 }),
    )
    const user = await openDetails()
    await user.click(pencil('specifications'))
    await user.type(screen.getByLabelText('Handle'), '-2')
    await user.click(saveButton('specifications'))
    await confirmUpdate(user)

    expect(
      await screen.findByText('A product with this handle already exists.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Handle')).toHaveValue('hippo-bag-2')
    expect(saveButton('specifications')).toBeEnabled()
  })

  it('edits the variants tab in place', async () => {
    const user = await openDetails()
    await user.click(screen.getByRole('tab', { name: /^Variants/ }))
    await user.click(pencil('variants'))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const price = screen.getByLabelText(/^Price/)
    await user.clear(price)
    await user.type(price, '27.5')
    await user.click(saveButton('variants'))
    await confirmUpdate(user)

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { variants: [{ id: VARIANT, price: '27.5' }] },
        'polymer-uk',
      ),
    )
  })

  describe('everything the update API takes can be edited on the Variants tab', () => {
    const LOCATION = 60465184951
    /** A product with a Size option, one variant with stock at one location and a picture. */
    const withOptions = () =>
      details.mockResolvedValue({
        ...DETAIL,
        has_only_default_variant: false,
        options: [{ name: 'Size', position: 1, values: ['M'] }],
        variants: [
          {
            ...DETAIL.variants[0],
            selected_options: [{ name: 'Size', value: 'M' }],
            image_url: 'https://cdn.example.com/1.jpg',
            inventory_levels: [
              { location_shopify_id: LOCATION, location_name: 'Unit 9', available: 5 },
            ],
          },
        ],
      })
    const editVariants = async () => {
      const user = await openDetails()
      await user.click(screen.getByRole('tab', { name: /^Variants/ }))
      await user.click(pencil('variants'))
      return user
    }

    it('sets the stock at a location, sending only the locations that changed', async () => {
      withOptions()
      const user = await editVariants()

      // Drawn like Add product's Inventory card: a Location / Quantity table with a dropdown.
      expect(screen.getByLabelText('Stock location 1')).toHaveValue(String(LOCATION))
      expect(screen.getByLabelText('Stock quantity 1')).toHaveValue('5')
      await user.clear(screen.getByLabelText('Stock quantity 1'))
      await user.type(screen.getByLabelText('Stock quantity 1'), '12')
      await user.click(saveButton('variants'))
      await confirmUpdate(user)

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'id-1',
          {
            variants: [
              { id: VARIANT, stock: [{ location_id: LOCATION, available: 12 }] },
            ],
          },
          'polymer-uk',
        ),
      )
    })

    it('puts stock at any of the store’s locations, chosen from the dropdown', async () => {
      vi.mocked(api.inventory.locations).mockResolvedValue([
        { id: LOCATION, name: 'Unit 9', variants: 1 },
        { id: 70137741495, name: 'Shop floor', variants: 1 },
      ])
      withOptions()
      const user = await editVariants()

      // The store's own list is in the dropdown (not only the locations the variant has).
      await user.click(screen.getByRole('button', { name: 'Add location' }))
      const location = await screen.findByLabelText('Stock location 2')
      await waitFor(() =>
        expect(
          within(location).getByRole('option', { name: 'Shop floor' }),
        ).toBeInTheDocument(),
      )
      await user.selectOptions(location, 'Shop floor')
      await user.type(screen.getByLabelText('Stock quantity 2'), '25')
      await user.click(saveButton('variants'))
      await confirmUpdate(user)

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'id-1',
          {
            variants: [
              { id: VARIANT, stock: [{ location_id: 70137741495, available: 25 }] },
            ],
          },
          'polymer-uk',
        ),
      )
    })

    it('moves a row to another location, and refuses the same location twice', async () => {
      withOptions()
      const user = await editVariants()

      await user.click(screen.getByRole('button', { name: 'Add location' }))
      await user.selectOptions(screen.getByLabelText('Stock location 2'), 'Unit 9')
      await user.type(screen.getByLabelText('Stock quantity 2'), '1')
      await user.click(saveButton('variants'))
      await confirmUpdate(user)

      expect(
        await screen.findByText('This location is already listed'),
      ).toBeInTheDocument()
      expect(update).not.toHaveBeenCalled()
    })

    it('refuses a stock quantity that is not a whole number', async () => {
      withOptions()
      const user = await editVariants()

      await user.clear(screen.getByLabelText('Stock quantity 1'))
      await user.type(screen.getByLabelText('Stock quantity 1'), '2.5')
      await user.click(saveButton('variants'))
      await confirmUpdate(user)

      expect(
        await screen.findByText('Enter a whole number, 0 or more'),
      ).toBeInTheDocument()
      expect(update).not.toHaveBeenCalled()
    })

    it('takes the picture off a variant with "No image"', async () => {
      withOptions()
      const user = await editVariants()

      await user.selectOptions(screen.getByLabelText('Image'), 'No image')
      await user.click(saveButton('variants'))
      await confirmUpdate(user)

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'id-1',
          { variants: [{ id: VARIANT, remove_image: true }] },
          'polymer-uk',
        ),
      )
    })

    it('renames an option and one of its values', async () => {
      withOptions()
      const user = await editVariants()

      const name = screen.getByLabelText(/^Option name/)
      await user.clear(name)
      await user.type(name, 'Pack Size')
      const value = screen.getByLabelText('Value “M” of Size')
      await user.clear(value)
      await user.type(value, 'Medium')
      await user.click(saveButton('variants'))
      await confirmUpdate(user)

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'id-1',
          {
            options_update: [
              {
                name: 'Size',
                new_name: 'Pack Size',
                values_rename: [{ from: 'M', to: 'Medium' }],
              },
            ],
          },
          'polymer-uk',
        ),
      )
    })

    it('adds an option and a variant that uses it, in one save', async () => {
      withOptions()
      const user = await editVariants()

      await user.click(screen.getByRole('button', { name: 'Add option' }))
      await user.type(screen.getByLabelText('New option name'), 'Colour')
      await user.type(screen.getByLabelText('Values of Colour'), 'Clear{Enter}')
      await user.click(screen.getByRole('button', { name: 'Add variant' }))

      const created = within(screen.getByRole('list', { name: 'New variants' }))
      await user.type(created.getByLabelText('Size'), 'L')
      await user.type(created.getByLabelText('Colour'), 'Clear')
      await user.type(created.getByLabelText(/^Price/), '39.99')
      await user.type(created.getByLabelText(/^SKU/), 'HSC-L')
      await user.click(created.getByRole('button', { name: 'Add location' }))
      await user.selectOptions(created.getByLabelText('Stock location 1'), 'Unit 9')
      await user.type(created.getByLabelText('Stock quantity 1'), '40')
      await user.type(
        created.getByLabelText(/^Image address/),
        'https://cdn.example.com/new.jpg',
      )
      await user.click(saveButton('variants'))
      await confirmUpdate(user)

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'id-1',
          {
            options_add: [{ name: 'Colour', values: ['Clear'] }],
            variants: [
              {
                option_values: ['L', 'Clear'],
                price: '39.99',
                taxable: true,
                inventory_policy: 'DENY',
                tracked: true,
                requires_shipping: true,
                sku: 'HSC-L',
                stock: [{ location_id: LOCATION, available: 40 }],
                image_url: 'https://cdn.example.com/new.jpg',
              },
            ],
          },
          'polymer-uk',
        ),
      )
    })

    it('needs a price and a value for every option before a new variant is sent', async () => {
      withOptions()
      const user = await editVariants()

      await user.click(screen.getByRole('button', { name: 'Add variant' }))
      await user.click(saveButton('variants'))
      await confirmUpdate(user)

      expect(await screen.findByText('Choose a Size')).toBeInTheDocument()
      expect(screen.getByText('Enter a price')).toBeInTheDocument()
      expect(update).not.toHaveBeenCalled()
    })

    it('does not make a second variant with the values one already has', async () => {
      withOptions()
      const user = await editVariants()

      await user.click(screen.getByRole('button', { name: 'Add variant' }))
      const created = within(screen.getByRole('list', { name: 'New variants' }))
      await user.type(created.getByLabelText('Size'), 'm')
      await user.type(created.getByLabelText(/^Price/), '9.99')
      await user.click(saveButton('variants'))
      await confirmUpdate(user)

      expect(
        await screen.findByText('A variant with these values already exists'),
      ).toBeInTheDocument()
      expect(update).not.toHaveBeenCalled()
    })

    it('asks for an option first when the product has only its default variant', async () => {
      const user = await editVariants()

      await user.click(screen.getByRole('button', { name: 'Add variant' }))
      await user.click(saveButton('variants'))
      await confirmUpdate(user)
      expect(
        await screen.findByText(/Add an option first \(for example Size\)/),
      ).toBeInTheDocument()
      expect(update).not.toHaveBeenCalled()
      // Options are added here too.
      expect(screen.getByRole('button', { name: 'Add option' })).toBeInTheDocument()
      // Removing the row again leaves nothing to send.
      await user.click(screen.getByRole('button', { name: 'Remove new variant 1' }))
      expect(saveButton('variants')).toBeDisabled()
    })
  })

  describe('removing a product from a collection with the ✕ on its chip', () => {
    // Collections sit in the Product Specifications card, under Tags; the ✕ is there while
    // the card is edited.
    const openCollections = async () => {
      const user = await openDetails()
      await user.click(pencil('specifications'))
      return user
    }

    it('shows the collections under Tags as chips, with a ✕ only while the card is edited', async () => {
      const user = await openDetails()

      // Viewing: a "Collections" heading and chips, no tab, no ✕.
      expect(screen.queryByRole('tab', { name: /^Collections/ })).toBeNull()
      expect(screen.getByRole('heading', { name: 'Collections' })).toBeInTheDocument()
      const viewing = screen.getByRole('list', { name: 'Collections' })
      expect(within(viewing).getByText('Best Sellers')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Remove from Best Sellers' }),
      ).toBeNull()
      expect(screen.queryByLabelText('Add to a collection')).toBeNull()

      await user.click(pencil('specifications'))
      const editing = screen.getByRole('list', { name: 'Collections' })
      expect(
        within(editing).getByRole('button', { name: 'Remove from Best Sellers' }),
      ).toBeInTheDocument()
      expect(screen.getByLabelText('Add to a collection')).toBeInTheDocument()
    })

    it('asks first, and sends nothing when Cancel is pressed', async () => {
      const user = await openCollections()
      await user.click(screen.getByRole('button', { name: 'Remove from Best Sellers' }))

      const alert = await screen.findByRole('alertdialog', {
        name: 'Remove from “Best Sellers”?',
      })
      expect(within(alert).getByRole('button', { name: 'Cancel' })).toHaveFocus()
      // A smart collection is filled by rules: the alert says the store may refuse.
      expect(within(alert).getByText(/smart collection/)).toBeInTheDocument()
      expect(update).not.toHaveBeenCalled()

      await user.click(within(alert).getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(update).not.toHaveBeenCalled()
      expect(screen.getByText('Best Sellers')).toBeInTheDocument()
    })

    it('removes only that collection when Remove is pressed, and the tile goes at once', async () => {
      const user = await openCollections()
      // Once removed, the store's own copy no longer has it either.
      details.mockResolvedValue({ ...DETAIL, collections: [] })
      await user.click(screen.getByRole('button', { name: 'Remove from Best Sellers' }))
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', {
          name: 'Remove',
        }),
      )

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'id-1',
          { collections_remove: ['Best Sellers'] },
          'polymer-uk',
        ),
      )
      expect(update).toHaveBeenCalledTimes(1)
      await waitFor(() =>
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
      )
      expect(
        await screen.findByText("This product isn't in any collection."),
      ).toBeInTheDocument()
    })

    it('keeps the alert open with the backend’s message when the store refuses', async () => {
      update.mockRejectedValue(
        new ApiError('A smart collection cannot be changed by hand.', { status: 422 }),
      )
      const user = await openCollections()
      await user.click(screen.getByRole('button', { name: 'Remove from Best Sellers' }))
      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', {
          name: 'Remove',
        }),
      )

      expect(
        await screen.findByText('A smart collection cannot be changed by hand.'),
      ).toBeInTheDocument()
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      // Nothing changed behind it.
      expect(screen.getAllByText('Best Sellers').length).toBeGreaterThan(0)
    })
  })

  describe('adding to a collection by searching the store’s collections', () => {
    // The backend's collections: the first is the one the product is already in, then 12 more.
    const OTHERS = Array.from({ length: 12 }, (_, i) => ({
      id: `aaaaaaaa-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      shopify_id: 100 + i,
      title: `Range ${String(i + 1).padStart(2, '0')}`,
      handle: `range-${i + 1}`,
      collection_type: 'custom',
      editable: true,
      products_count: i,
    }))
    const EVERY = [
      { ...DETAIL.collections[0], editable: false, products_count: 68 },
      ...OTHERS,
    ]
    const search = vi.mocked(api.collections.list)
    const create = vi.mocked(api.collections.create)

    beforeEach(() => {
      // Nothing a test said about creating a collection carries over to the next one.
      create.mockReset()
      // A fake `GET /collections`: the collections whose name or handle contains `search`.
      search.mockImplementation(async (params) => {
        const needle = (params.search ?? '').toLowerCase()
        const items = EVERY.filter(
          (collection) =>
            collection.title.toLowerCase().includes(needle) ||
            collection.handle.toLowerCase().includes(needle),
        )
        const size = params.page_size ?? 50
        return {
          items: items.slice(0, size),
          page: 1,
          page_size: size,
          total: items.length,
          total_pages: 1,
          has_next: false,
        }
      })
    })

    async function openAdd() {
      const user = userEvent.setup()
      renderPage('/products/id-1')
      await screen.findByRole('heading', { level: 1, name: 'Hippo Bag' })
      await user.click(pencil('specifications'))
      return user
    }
    const box = () => screen.getByRole('combobox', { name: 'Add to a collection' })
    const list = () => screen.queryByRole('listbox', { name: 'Collections to add' })
    /** The options once the search answer has arrived. */
    const options = async () =>
      within(
        await screen.findByRole('listbox', { name: 'Collections to add' }),
      ).findAllByRole('option')
    /** The store's collections in the dropdown. */
    const found = async () => options()

    it('shows nothing and asks for nothing by default — the search only starts once something is typed', async () => {
      const user = await openAdd()
      // With nothing typed there is no list (and the box doesn't steal the focus from the fields).
      expect(box()).not.toHaveFocus()
      expect(list()).toBeNull()
      await user.click(box())
      expect(list()).toBeNull()
      expect(search).not.toHaveBeenCalled()

      await user.type(box(), 'r')
      expect(list()).not.toBeNull()

      // Clearing the box puts it away again.
      await user.clear(box())
      expect(list()).toBeNull()
    })

    it('searches the product’s store for what was typed, once typing pauses', async () => {
      const user = await openAdd()

      await user.type(box(), 'range')
      await options()

      // One request for the whole word (not one per key), for the product's own store.
      expect(search).toHaveBeenCalledTimes(1)
      expect(search).toHaveBeenCalledWith({
        search: 'range',
        type: 'custom',
        sort: 'title',
        order: 'asc',
        page_size: 10,
        shop: 'polymer-uk',
      })
    })

    it('shows ten at most, related to what was typed, and says there are more', async () => {
      const user = await openAdd()

      // "range" matches all twelve: ten are shown, in a dropdown over the tiles below.
      await user.type(box(), 'range')
      const rows = await found()
      expect(rows).toHaveLength(10)
      expect(rows[0]).toHaveTextContent('Range 01')
      expect(
        await screen.findByText('Showing 10 of 12 — keep typing to narrow the list.'),
      ).toBeVisible()
      // Drawn on top of the page (so nothing clips it), not a block that pushes the tiles down.
      expect(list()!.parentElement!.className).toContain('fixed')
      expect(list()!.parentElement!.parentElement).toBe(document.body)

      // "range 0" matches nine (01–09): all nine, each related to the text.
      await user.type(box(), ' 0')
      await waitFor(async () => expect(await found()).toHaveLength(9))
      const titles = (await found()).map(
        (row) => row.querySelector('p')?.textContent ?? '',
      )
      expect(titles.every((title) => title.toLowerCase().includes('range 0'))).toBe(true)
      expect(screen.queryByText(/^Showing 10 of/)).toBeNull()
    })

    it('does not offer the collection the product is already in', async () => {
      const user = await openAdd()

      await user.type(box(), 'best')
      // The backend finds it, but the product is in it already: nothing is offered.
      await waitFor(() => expect(search).toHaveBeenCalled())
      expect(await screen.findByText(/^No collection matches “best”/)).toBeVisible()
      expect(within(list()!).queryByText('Best Sellers')).toBeNull()
    })

    it('asks the backend for manual collections only, and shows its answer as it is', async () => {
      search.mockResolvedValue({
        items: [
          { ...OTHERS[5], title: 'Zeta juice' },
          { ...OTHERS[0], title: 'Alpha juice' },
        ],
        page: 1,
        page_size: 10,
        total: 2,
        total_pages: 1,
        has_next: false,
      })
      const user = await openAdd()

      await user.type(box(), 'juice')
      const rows = await found()

      // No sorting or filtering here: the backend's order and rows.
      expect(rows.map((row) => row.querySelector('p')?.textContent)).toEqual([
        'Zeta juice',
        'Alpha juice',
      ])
      expect(search).toHaveBeenCalledWith(expect.objectContaining({ type: 'custom' }))
    })

    it('says it is searching while the answer is on its way', async () => {
      search.mockImplementation(() => new Promise(() => undefined))
      const user = await openAdd()

      await user.type(box(), 'range')

      expect(await screen.findByText('Searching collections…')).toBeVisible()
    })

    it('says so when the search fails', async () => {
      search.mockRejectedValue(new ApiError('Server error', { status: 500 }))
      const user = await openAdd()

      await user.type(box(), 'range')

      expect(
        await screen.findByText(
          'Could not search the collections. Try again in a moment.',
        ),
      ).toBeVisible()
    })

    it('is not clipped, and follows its box when the page scrolls instead of closing', async () => {
      const user = await openAdd()
      const row = box().parentElement!
      let top = 300
      const original = row.getBoundingClientRect
      row.getBoundingClientRect = () =>
        ({
          top,
          bottom: top + 40,
          left: 20,
          right: 620,
          width: 600,
          height: 40,
          x: 20,
          y: top,
          toJSON: () => ({}),
        }) as DOMRect
      try {
        await user.type(box(), 'range')
        await options()
        expect(list()!.parentElement).toHaveStyle({ top: '344px', width: '600px' })

        top = 200
        fireEvent.scroll(window)
        expect(list()).not.toBeNull()
        expect(list()!.parentElement).toHaveStyle({ top: '244px' })

        // Scrolled out of view: hidden until it is back.
        top = -300
        fireEvent.scroll(window)
        expect(list()).toBeNull()
        top = 300
        fireEvent.scroll(window)
        expect(list()).not.toBeNull()
      } finally {
        row.getBoundingClientRect = original
      }
    })

    it('says so when nothing matches, and offers to create it with Add', async () => {
      const user = await openAdd()

      await user.type(box(), 'avdcd')

      expect(
        await screen.findByText(
          'No collection matches “avdcd”. Press Add to create it as a new collection.',
        ),
      ).toBeVisible()
      expect(within(list()!).queryByRole('option')).toBeNull()
    })

    /** Answers "Add to “X”?" with Yes. */
    const confirmAdd = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
      const alert = await screen.findByRole('alertdialog', { name: `Add to “${name}”?` })
      await user.click(within(alert).getByRole('button', { name: 'Yes, add' }))
    }

    it('fills the box with the clicked collection; Add then asks, and only "Yes, add" sends the PUT', async () => {
      const user = await openAdd()
      await user.type(box(), 'range 03')
      await user.click(await screen.findByRole('option', { name: /Range 03/ }))

      // Choosing only fills the box (no list, nothing sent, no second search).
      expect(box()).toHaveValue('Range 03')
      expect(list()).toBeNull()
      expect(update).not.toHaveBeenCalled()
      expect(search).toHaveBeenCalledTimes(1)

      await user.click(screen.getByRole('button', { name: 'Add' }))
      const alert = await screen.findByRole('alertdialog', { name: 'Add to “Range 03”?' })
      expect(within(alert).getByRole('button', { name: 'Cancel' })).toHaveFocus()
      expect(update).not.toHaveBeenCalled()

      await user.click(within(alert).getByRole('button', { name: 'Yes, add' }))
      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'id-1',
          { collections_add: ['Range 03'] },
          'polymer-uk',
        ),
      )
      expect(update).toHaveBeenCalledTimes(1)
      // Still just the one search: the chosen name needed no second look-up.
      expect(search).toHaveBeenCalledTimes(1)
      // Done: the dialog is put away and the box is empty, ready for the next one.
      await waitFor(() =>
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
      )
      expect(box()).toHaveValue('')
    })

    it('moves with the arrow keys and fills the box with the highlighted one on Enter; Escape closes only the list', async () => {
      const user = await openAdd()
      await user.type(box(), 'range')
      await options()

      await user.keyboard('{ArrowDown}{ArrowDown}')
      expect(within(list()!).getByRole('option', { name: /Range 02/ })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      await user.keyboard('{Escape}')
      expect(list()).toBeNull()

      // Clicking the box brings the list back (what was typed is still there).
      await user.click(box())
      expect(list()).not.toBeNull()
      await user.keyboard('{ArrowDown}{Enter}')
      expect(box()).toHaveValue('Range 01')
      expect(update).not.toHaveBeenCalled()

      // A second Enter is "Add".
      await user.keyboard('{Enter}')
      await confirmAdd(user, 'Range 01')
      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'id-1',
          { collections_add: ['Range 01'] },
          'polymer-uk',
        ),
      )
    })

    it('adds a collection typed in full with Enter or the Add button — without waiting for the pause', async () => {
      const user = await openAdd()

      // The exact name (any case), no need to click the list.
      await user.type(box(), 'range 04{Enter}')
      await confirmAdd(user, 'Range 04')
      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'id-1',
          { collections_add: ['Range 04'] },
          'polymer-uk',
        ),
      )
      await waitFor(() =>
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
      )

      // The box is empty again; use the Add button this time.
      expect(box()).toHaveValue('')
      await user.type(box(), 'Range 12')
      await user.click(screen.getByRole('button', { name: 'Add' }))
      await confirmAdd(user, 'Range 12')
      await waitFor(() =>
        expect(update).toHaveBeenLastCalledWith(
          'id-1',
          { collections_add: ['Range 12'] },
          'polymer-uk',
        ),
      )
    })

    /** Answers "Create “X”?" with Yes. */
    const confirmCreate = async (
      user: ReturnType<typeof userEvent.setup>,
      name: string,
    ) => {
      const alert = await screen.findByRole('alertdialog', { name: `Create “${name}”?` })
      await user.click(within(alert).getByRole('button', { name: 'Yes, create' }))
    }

    it('makes a new collection for a name the store does not have: POST /collections, with this product in it', async () => {
      create.mockResolvedValue({
        message: "Collection 'Juice Bottles' created in Shopify with 1 product(s).",
        collection: {
          ...NEW_COLLECTION,
          title: 'Juice Bottles',
          handle: 'juice-bottles',
        },
      })
      const user = await openAdd()

      // Not in the list: the dropdown says so, and Add offers to make it.
      await user.type(box(), 'Juice Bottles')
      expect(
        await screen.findByText(
          /No collection matches “Juice Bottles”\. Press Add to create/,
        ),
      ).toBeVisible()
      await user.click(screen.getByRole('button', { name: 'Add' }))

      const alert = await screen.findByRole('alertdialog', {
        name: 'Create “Juice Bottles”?',
      })
      expect(within(alert).getByRole('button', { name: 'Cancel' })).toHaveFocus()
      expect(create).not.toHaveBeenCalled()

      await user.click(within(alert).getByRole('button', { name: 'Yes, create' }))
      await waitFor(() =>
        expect(create).toHaveBeenCalledWith({
          title: 'Juice Bottles',
          shop: 'polymer-uk',
          products: ['id-1'],
        }),
      )
      expect(create).toHaveBeenCalledTimes(1)
      // Making it is not an update of the product: no PUT.
      expect(update).not.toHaveBeenCalled()
      expect(
        await screen.findByText(
          "Collection 'Juice Bottles' created in Shopify with 1 product(s).",
        ),
      ).toBeVisible()
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(box()).toHaveValue('')
    })

    it('keeps the question open with the backend’s message when making the collection fails', async () => {
      create.mockRejectedValue(
        new ApiError('A collection called “Juice Bottles” already exists.', {
          status: 422,
        }),
      )
      const user = await openAdd()

      await user.type(box(), 'Juice Bottles{Enter}')
      await confirmCreate(user, 'Juice Bottles')

      expect(
        await screen.findByText('A collection called “Juice Bottles” already exists.'),
      ).toBeVisible()
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      expect(create).toHaveBeenCalledTimes(1)
      expect(update).not.toHaveBeenCalled()
    })

    it('sends nothing when Cancel is pressed on the "Create" question', async () => {
      const user = await openAdd()

      await user.type(box(), 'Juice Bottles{Enter}')
      const alert = await screen.findByRole('alertdialog', {
        name: 'Create “Juice Bottles”?',
      })
      await user.click(within(alert).getByRole('button', { name: 'Cancel' }))

      expect(create).not.toHaveBeenCalled()
      expect(update).not.toHaveBeenCalled()
      expect(box()).toHaveValue('Juice Bottles')
    })

    it('adds to the existing collection, not a new one, when the typed name is one the store has (any case)', async () => {
      const user = await openAdd()

      await user.type(box(), 'RANGE 08{Enter}')
      await confirmAdd(user, 'Range 08')

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'id-1',
          { collections_add: ['Range 08'] },
          'polymer-uk',
        ),
      )
      expect(create).not.toHaveBeenCalled()
    })

    it('uses the store’s own spelling when the typed name is one the list shows', async () => {
      const user = await openAdd()

      await user.type(box(), 'RANGE 08')
      await screen.findByRole('option', { name: /Range 08/ })
      await user.keyboard('{Enter}')
      await confirmAdd(user, 'Range 08')
      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'id-1',
          { collections_add: ['Range 08'] },
          'polymer-uk',
        ),
      )
      expect(create).not.toHaveBeenCalled()
    })

    it('does not risk a second collection when the search cannot say whether the name exists', async () => {
      search.mockRejectedValue(new ApiError('Server error', { status: 500 }))
      const user = await openAdd()

      await user.type(box(), 'zzz{Enter}')
      // Unknown, so the safe request (the update, which the backend refuses for an unknown name).
      await confirmAdd(user, 'zzz')

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'id-1',
          { collections_add: ['zzz'] },
          'polymer-uk',
        ),
      )
      expect(create).not.toHaveBeenCalled()
    })

    it('does not make a collection when the answer was cut short and the name could be further on', async () => {
      search.mockResolvedValue({
        items: OTHERS.slice(0, 3),
        page: 1,
        page_size: 50,
        total: 80,
        total_pages: 2,
        has_next: true,
      })
      const user = await openAdd()

      await user.type(box(), 'range{Enter}')
      await confirmAdd(user, 'range')

      await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
      expect(create).not.toHaveBeenCalled()
    })

    it('explains, and switches off "Yes, add", when the store has no collection to add to', async () => {
      search.mockRejectedValue(new ApiError('Server error', { status: 500 }))
      update.mockRejectedValue(
        new ApiError("Collection problem: 'adbc' not found", { status: 422 }),
      )
      const user = await openAdd()

      await user.type(box(), 'adbc{Enter}')
      await confirmAdd(user, 'adbc')

      expect(
        await screen.findByText("Collection problem: 'adbc' not found"),
      ).toBeVisible()
      expect(screen.getByText(/The store has no collection called “adbc”/)).toBeVisible()
      expect(screen.getByRole('button', { name: 'Yes, add' })).toBeDisabled()
      expect(update).toHaveBeenCalledTimes(1)
    })

    it('says so when the name is of a collection the product is already in', async () => {
      const user = await openAdd()

      await user.type(box(), 'Best Sellers{Enter}')

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The product is already in that collection',
      )
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(update).not.toHaveBeenCalled()
    })

    it('sends nothing on Cancel, and keeps what was typed', async () => {
      const user = await openAdd()
      await user.type(box(), 'range 05{Enter}')

      const alert = await screen.findByRole('alertdialog', { name: 'Add to “Range 05”?' })
      await user.click(within(alert).getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
      expect(update).not.toHaveBeenCalled()
      expect(box()).toHaveValue('range 05')
    })

    it('keeps the question open with the backend’s message when the store refuses', async () => {
      update.mockRejectedValue(
        new ApiError("'Range 06' is a smart collection.", { status: 422 }),
      )
      const user = await openAdd()
      await user.type(box(), 'range 06{Enter}')
      await confirmAdd(user, 'Range 06')

      expect(await screen.findByText("'Range 06' is a smart collection.")).toBeVisible()
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })

    it('calls GET /collections only to search, and PUT only after the question is answered', async () => {
      const user = await openAdd()

      await user.type(box(), 'range 03')
      await user.click(await screen.findByRole('option', { name: /Range 03/ }))
      await user.click(screen.getByRole('button', { name: 'Add' }))

      // Searching asked for the list; choosing one and pressing Add sent nothing yet.
      expect(search).toHaveBeenCalledTimes(1)
      expect(update).not.toHaveBeenCalled()

      await confirmAdd(user, 'Range 03')
      await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { collections_add: ['Range 03'] },
        'polymer-uk',
      )
      expect(search).toHaveBeenCalledTimes(1)
    })
  })

  it('has no Collections tab and no Save of its own: collections go in with the specifications card', async () => {
    const user = await openDetails()

    expect(screen.queryByRole('tab', { name: /^Collections/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit collections' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add collection' })).toBeNull()

    // The box appears with the card's pencil — and says collections are not part of Save.
    await user.click(pencil('specifications'))
    expect(screen.getByLabelText('Add to a collection')).toBeInTheDocument()
    expect(screen.getByText(/aren.t part of Save/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save collections' })).toBeNull()
  })

  it('puts the add box under the collection chips, and away again when the edit is discarded', async () => {
    const user = await openDetails()
    await user.click(pencil('specifications'))

    const box = screen.getByLabelText('Add to a collection')
    expect(box).toHaveAttribute('placeholder', 'Type a collection name')

    // Under the chips.
    const list = screen.getByRole('list', { name: 'Collections' })
    expect(
      list.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    await user.click(discardButton('specifications'))
    expect(screen.queryByLabelText('Add to a collection')).not.toBeInTheDocument()
  })

  it('adds a collection: type its name, Add, "Yes, add" — and its chip shows at once', async () => {
    const user = await openDetails()
    await user.click(pencil('specifications'))

    vi.mocked(api.collections.list).mockResolvedValue({
      items: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          title: 'Food Packaging',
          handle: 'food-packaging',
          collection_type: 'custom',
          editable: true,
        },
      ],
      page: 1,
      page_size: 10,
      total: 1,
      total_pages: 1,
      has_next: false,
    })
    // The store's own copy has it once the update went through.
    details.mockResolvedValue({
      ...DETAIL,
      collections: [
        ...DETAIL.collections,
        {
          id: '55555555-5555-4555-8555-555555555555',
          shopify_id: 555,
          title: 'Food Packaging',
          handle: 'food-packaging',
          collection_type: 'custom',
        },
      ],
    })
    await user.type(screen.getByLabelText('Add to a collection'), 'Food Packaging{Enter}')
    await user.click(
      within(
        await screen.findByRole('alertdialog', { name: 'Add to “Food Packaging”?' }),
      ).getByRole('button', { name: 'Yes, add' }),
    )

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { collections_add: ['Food Packaging'] },
        'polymer-uk',
      ),
    )
    const items = await within(
      await screen.findByRole('list', { name: 'Collections' }),
    ).findAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Food Packaging'),
        expect.stringContaining('Best Sellers'),
      ]),
    )
  })

  it('edits the media tab in place', async () => {
    const user = await openDetails()
    await user.click(screen.getByRole('tab', { name: /^Media/ }))
    await user.click(pencil('media'))
    await user.click(screen.getByRole('button', { name: 'Move image 2 up' }))
    await user.click(saveButton('media'))
    await confirmUpdate(user)

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { media_order: [IMAGE_2, IMAGE_1] },
        'polymer-uk',
      ),
    )
  })

  it('shows the new value in the section at once, before any refetch answers', async () => {
    const user = await openDetails()
    details.mockImplementation(never)
    list.mockImplementation(never)

    await user.click(pencil('specifications'))
    const vendor = screen.getByLabelText('Vendor')
    await user.clear(vendor)
    await user.type(vendor, 'Acme Packaging')
    await user.click(saveButton('specifications'))
    await confirmUpdate(user)

    // Both the header and the specifications show it — patched into the cache at once.
    expect((await screen.findAllByText('Acme Packaging')).length).toBeGreaterThanOrEqual(
      2,
    )
    expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument()
  })
})

describe('the Variants editor is laid out in sections, like Add product', () => {
  const LOCATION = 60465184951

  beforeEach(() => {
    list.mockResolvedValue(LIST)
    update.mockResolvedValue(WRITE_OK)
    syncHistory.mockResolvedValue([])
    // 5 available, 3 committed and 10 on hand: so 2 are unavailable.
    details.mockResolvedValue({
      ...DETAIL,
      variants: [
        {
          ...DETAIL.variants[0],
          cost: '10.00',
          inventory_levels: [
            {
              location_shopify_id: LOCATION,
              location_name: 'Unit 9',
              available: 5,
              committed: 3,
              on_hand: 10,
            },
          ],
        },
      ],
    } as unknown as ProductDetail)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  async function editVariants() {
    const user = userEvent.setup()
    renderPage('/products/id-1')
    await screen.findByRole('heading', { level: 1, name: 'Hippo Bag' })
    await user.click(screen.getByRole('tab', { name: /^Variants/ }))
    await user.click(screen.getByRole('button', { name: 'Edit variants' }))
    return user
  }
  const save = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Save variants' }))
    await confirmUpdate(user)
  }

  it('has a Price, an Inventory and a Shipping card for the variant', async () => {
    await editVariants()

    expect(screen.getByRole('region', { name: 'Pricing of M' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Inventory of M' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Shipping of M' })).toBeInTheDocument()
    // The price is in a box with the store's currency in front of it.
    expect(
      within(screen.getByRole('region', { name: 'Pricing of M' })).getByText('£'),
    ).toBeInTheDocument()
  })

  it('keeps the price extras behind pills and a chevron, and a pill opens its own field', async () => {
    const user = await editVariants()
    const pricing = within(screen.getByRole('region', { name: 'Pricing of M' }))
    expect(pricing.queryByLabelText('Compare-at price')).not.toBeInTheDocument()

    await user.click(pricing.getByRole('button', { name: /^Compare-at/ }))
    await user.type(screen.getByLabelText('Compare-at price'), '30')
    await save(user)

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { variants: [{ id: VARIANT, compare_at_price: '30' }] },
        'polymer-uk',
      ),
    )
  })

  it('works out the profit and margin from the cost, like Add product', async () => {
    const user = await editVariants()
    await user.click(screen.getByRole('button', { name: 'Show more options' }))

    // 25.85 price, 10.00 cost.
    expect(screen.getByText(/Profit £15\.85 · Margin 61\.3%/)).toBeInTheDocument()
  })

  it('shows the store’s stock figures, and On hand follows the quantity typed', async () => {
    const user = await editVariants()
    const row = within(
      screen.getByRole('list', { name: 'Stock of M' }).children[0] as HTMLElement,
    )

    // Unavailable 2 · Committed 3 · Available 5 (editable) · On hand 10.
    expect(row.getByText('2')).toBeInTheDocument()
    expect(row.getByText('3')).toBeInTheDocument()
    expect(row.getByText('10')).toBeInTheDocument()
    expect(screen.getByLabelText('Stock quantity 1')).toHaveValue('5')

    await user.clear(screen.getByLabelText('Stock quantity 1'))
    await user.type(screen.getByLabelText('Stock quantity 1'), '12')

    // 12 available + 3 committed + 2 unavailable.
    expect(row.getByText('17')).toBeInTheDocument()
  })

  it('turns stock tracking off with the Inventory tracked switch, and hides the table', async () => {
    const user = await editVariants()

    await user.click(screen.getByRole('switch', { name: 'Inventory tracked' }))

    expect(screen.getByText(/Stock is not tracked for this variant/)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Stock of M' })).not.toBeInTheDocument()
    await save(user)
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { variants: [{ id: VARIANT, tracked: false }] },
        'polymer-uk',
      ),
    )
  })

  it('sets SKU, barcode and "Continue selling when out of stock" under More details', async () => {
    const user = await editVariants()
    const inventory = within(screen.getByRole('region', { name: 'Inventory of M' }))

    await user.clear(inventory.getByLabelText(/^SKU/))
    await user.type(inventory.getByLabelText(/^SKU/), 'SC05')
    await user.type(inventory.getByLabelText(/^Barcode/), '5000')
    await user.click(
      inventory.getByRole('checkbox', { name: /Continue selling when out of stock/ }),
    )
    await save(user)

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        {
          variants: [
            { id: VARIANT, sku: 'SC05', barcode: '5000', inventory_policy: 'CONTINUE' },
          ],
        },
        'polymer-uk',
      ),
    )
  })

  it('has a Physical product switch, and the weight only while it is on', async () => {
    const user = await editVariants()
    const shipping = within(screen.getByRole('region', { name: 'Shipping of M' }))
    expect(shipping.getByLabelText(/^Weight \(optional\)/)).toHaveValue('100')

    await user.click(shipping.getByRole('switch', { name: 'Physical product' }))

    expect(shipping.queryByLabelText(/^Weight \(optional\)/)).not.toBeInTheDocument()
    await save(user)
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { variants: [{ id: VARIANT, requires_shipping: false }] },
        'polymer-uk',
      ),
    )
  })
})

describe('the Inventory tab is editable too', () => {
  const LOCATION = 60465184951

  const withLevels = (levels: unknown[]) =>
    details.mockResolvedValue({
      ...DETAIL,
      variants: [{ ...DETAIL.variants[0], inventory_levels: levels }],
    } as unknown as ProductDetail)

  beforeEach(() => {
    list.mockResolvedValue(LIST)
    update.mockResolvedValue(WRITE_OK)
    syncHistory.mockResolvedValue([])
    withLevels([
      {
        location_shopify_id: LOCATION,
        location_name: 'Unit 9',
        available: 5,
        committed: 3,
        on_hand: 10,
      },
    ])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  async function editInventory() {
    const user = userEvent.setup()
    renderPage('/products/id-1')
    await screen.findByRole('heading', { level: 1, name: 'Hippo Bag' })
    await user.click(screen.getByRole('tab', { name: /^Inventory/ }))
    return user
  }
  const save = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Save inventory' }))
    await confirmUpdate(user)
  }

  it('shows the store’s figures until the pencil is pressed', async () => {
    await editInventory()

    expect(screen.getByRole('columnheader', { name: 'Committed' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Stock quantity 1')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit inventory' })).toBeInTheDocument()
    expect(screen.getByText('1 location')).toBeInTheDocument()
  })

  it('turns into the Inventory card of each variant, with Save off until something changes', async () => {
    const user = await editInventory()
    await user.click(screen.getByRole('button', { name: 'Edit inventory' }))

    expect(screen.getByRole('region', { name: 'Inventory of M' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Inventory tracked' })).toBeChecked()
    expect(screen.getByLabelText('Stock quantity 1')).toHaveValue('5')
    expect(screen.getByRole('button', { name: 'Save inventory' })).toBeDisabled()
  })

  it('saves a changed quantity as that variant’s stock, after asking', async () => {
    const user = await editInventory()
    await user.click(screen.getByRole('button', { name: 'Edit inventory' }))

    await user.clear(screen.getByLabelText('Stock quantity 1'))
    await user.type(screen.getByLabelText('Stock quantity 1'), '12')
    await user.click(screen.getByRole('button', { name: 'Save inventory' }))
    expect(update).not.toHaveBeenCalled()
    await confirmUpdate(user)

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        {
          variants: [{ id: VARIANT, stock: [{ location_id: LOCATION, available: 12 }] }],
        },
        'polymer-uk',
      ),
    )
  })

  it('also edits SKU, barcode and continue selling from here', async () => {
    const user = await editInventory()
    await user.click(screen.getByRole('button', { name: 'Edit inventory' }))

    await user.clear(screen.getByLabelText(/^SKU/))
    await user.type(screen.getByLabelText(/^SKU/), 'SC05')
    await user.click(
      screen.getByRole('checkbox', { name: /Continue selling when out of stock/ }),
    )
    await save(user)

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { variants: [{ id: VARIANT, sku: 'SC05', inventory_policy: 'CONTINUE' }] },
        'polymer-uk',
      ),
    )
  })

  it('Discard throws the changes away without asking the server', async () => {
    const user = await editInventory()
    await user.click(screen.getByRole('button', { name: 'Edit inventory' }))
    await user.type(screen.getByLabelText('Stock quantity 1'), '9')

    await user.click(screen.getByRole('button', { name: 'Discard inventory changes' }))

    expect(screen.queryByLabelText('Stock quantity 1')).not.toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
  })

  it('lets a variant with no stock recorded get its first location', async () => {
    withLevels([])
    vi.mocked(api.inventory.locations).mockResolvedValue([
      { id: LOCATION, name: 'Unit 9', variants: 1 },
    ])
    const user = await editInventory()
    expect(
      screen.getByText('No inventory levels are tracked for this product.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit inventory' }))
    await user.click(screen.getByRole('button', { name: 'Add location' }))
    await user.selectOptions(await screen.findByLabelText('Stock location 1'), 'Unit 9')
    await user.type(screen.getByLabelText('Stock quantity 1'), '8')
    await save(user)

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { variants: [{ id: VARIANT, stock: [{ location_id: LOCATION, available: 8 }] }] },
        'polymer-uk',
      ),
    )
  })
})

describe('a variant picture by web address, in the Variants editor', () => {
  const ADDRESS = 'https://example.com/black.jpg'

  beforeEach(() => {
    list.mockResolvedValue(LIST)
    details.mockResolvedValue(DETAIL)
    update.mockResolvedValue(WRITE_OK)
    syncHistory.mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  async function editVariants() {
    const user = userEvent.setup()
    const view = renderPage('/products/id-1')
    await screen.findByRole('heading', { level: 1, name: 'Hippo Bag' })
    await user.click(screen.getByRole('tab', { name: /^Variants/ }))
    await user.click(screen.getByRole('button', { name: 'Edit variants' }))
    return { user, view }
  }

  it('adds the address to the product’s pictures and waits for the store to link it', async () => {
    const { user, view } = await editVariants()

    await user.type(screen.getByLabelText(/^Or add a picture by web address/), ADDRESS)
    await user.click(screen.getByRole('button', { name: 'Save variants' }))
    await confirmUpdate(user)

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { media_add: [{ url: ADDRESS, media_type: 'IMAGE' }] },
        'polymer-uk',
      ),
    )
    // The variant is linked to it once the file has arrived (see usePendingMediaSync).
    await waitFor(() =>
      expect(view.store.getState().products.pendingMedia['id-1']).toMatchObject({
        items: [{ url: ADDRESS, media_type: 'IMAGE' }],
        variantLinks: [{ variantId: VARIANT, url: ADDRESS }],
      }),
    )
  })

  it('refuses an address that is not https, and sends nothing', async () => {
    const { user } = await editVariants()

    await user.type(
      screen.getByLabelText(/^Or add a picture by web address/),
      'http://example.com/a.jpg',
    )
    await user.click(screen.getByRole('button', { name: 'Save variants' }))

    expect(await screen.findByText('Use a public https:// address')).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
  })

  it('choosing a picture from the list clears the typed address', async () => {
    const { user } = await editVariants()
    const box = screen.getByLabelText(/^Or add a picture by web address/)
    await user.type(box, ADDRESS)

    await user.selectOptions(screen.getByLabelText('Image'), IMAGE_2)

    expect(box).toHaveValue('')
  })
})
