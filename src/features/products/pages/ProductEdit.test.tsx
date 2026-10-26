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
import { fetchProductDetails } from '../../../app/store/productsSlice.ts'
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

describe('editing a product', () => {
  beforeEach(() => {
    list.mockResolvedValue(LIST)
    details.mockResolvedValue(DETAIL)
    update.mockResolvedValue(WRITE_OK)
    syncHistory.mockResolvedValue([])
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

  it('has no way to add a variant — the update API cannot manage options', async () => {
    const user = await openDetails()
    await user.click(screen.getByRole('tab', { name: /^Variants/ }))
    expect(
      screen.queryByRole('button', { name: /add (a )?variant/i }),
    ).not.toBeInTheDocument()

    await user.click(pencil('variants'))
    expect(
      screen.queryByRole('button', { name: /add (a )?variant/i }),
    ).not.toBeInTheDocument()
    // Existing variants can still be removed.
    expect(screen.getByRole('button', { name: /^Remove variant/ })).toBeInTheDocument()
  })

  describe('removing a product from a collection with the ✕ on its tile', () => {
    const openCollections = async () => {
      const user = await openDetails()
      await user.click(screen.getByRole('tab', { name: /^Collections/ }))
      return user
    }

    it('shows three columns of tiles, each with a ✕ by default — no pencil needed', async () => {
      await openCollections()

      const list = screen.getByRole('list', { name: 'Collections' })
      expect(list.className).toContain('lg:grid-cols-3')
      expect(
        within(list).getByRole('button', { name: 'Remove from Best Sellers' }),
      ).toBeInTheDocument()
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
          { collections_remove: ['col1'] },
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

  describe('adding to a collection from the list of the collections already known', () => {
    // Other products' details are in the cache (the app learns collections as products are
    // opened): 12 more collections, the first of which the product is already in.
    const OTHERS = Array.from({ length: 12 }, (_, i) => ({
      id: `aaaaaaaa-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      shopify_id: 100 + i,
      title: `Range ${String(i + 1).padStart(2, '0')}`,
      handle: `range-${i + 1}`,
      collection_type: 'custom',
    }))

    async function openAdd() {
      const user = userEvent.setup()
      const { store } = renderPage('/products/id-1')
      await screen.findByRole('heading', { level: 1, name: 'Hippo Bag' })
      store.dispatch(
        fetchProductDetails.fulfilled(
          {
            data: { ...DETAIL, id: 'id-9', collections: OTHERS } as ProductDetail,
            fetchedAt: Date.now(),
          },
          'req',
          { id: 'id-9' },
        ),
      )
      await user.click(screen.getByRole('tab', { name: /^Collections/ }))
      await user.click(screen.getByRole('button', { name: 'Add collection' }))
      return user
    }
    const box = () => screen.getByRole('combobox', { name: 'Add to a collection' })
    const list = () => screen.queryByRole('listbox', { name: 'Collections to add' })

    it('shows nothing by default — the dropdown only opens once something is typed', async () => {
      const user = await openAdd()
      // "Add collection" puts the cursor in the box, but with nothing typed there is no list.
      expect(box()).toHaveFocus()
      expect(list()).toBeNull()
      await user.click(box())
      expect(list()).toBeNull()

      await user.type(box(), 'r')
      expect(list()).not.toBeNull()

      // Clearing the box puts it away again.
      await user.clear(box())
      expect(list()).toBeNull()
    })

    it('shows ten at most once something is typed, related to it, and says there are more', async () => {
      const user = await openAdd()

      // "range" matches all twelve: ten are shown, in a dropdown over the tiles below.
      await user.type(box(), 'range')
      const rows = within(list()!).getAllByRole('option')
      expect(rows).toHaveLength(10)
      expect(rows[0]).toHaveTextContent('Range 01')
      // The product's own collection (Best Sellers) isn't offered again.
      expect(within(list()!).queryByText('Best Sellers')).toBeNull()
      expect(
        screen.getByText('Showing 10 of 12 — keep typing to narrow the list.'),
      ).toBeVisible()
      // Drawn on top of the page (so nothing clips it), not a block that pushes the tiles down.
      expect(list()!.parentElement!.className).toContain('fixed')
      expect(list()!.parentElement!.parentElement).toBe(document.body)

      // "range 0" matches nine (01–09): all nine, each related to the text.
      await user.type(box(), ' 0')
      const titles = within(list()!)
        .getAllByRole('option')
        .map((row) => row.querySelector('p')?.textContent ?? '')
      expect(titles).toHaveLength(9)
      expect(titles.every((title) => title.toLowerCase().includes('range 0'))).toBe(true)
      expect(screen.queryByText(/^Showing 10 of/)).toBeNull()
    })

    it('narrows the list as you type, and shows them all once few enough', async () => {
      const user = await openAdd()

      await user.type(box(), 'range 1')

      // Range 10, 11, 12 and Range 1x…: "range 1" matches 10, 11, 12 and 01? ("range 01" has no "1" right after "range ").
      expect(
        within(list()!)
          .getAllByRole('option')
          .map((row) => row.querySelector('p')?.textContent),
      ).toEqual(['Range 10', 'Range 11', 'Range 12'])
      expect(screen.queryByText(/^Showing 10 of/)).toBeNull()
    })

    it('reads the products on the list to learn their collections when the box opens, and says so while they load', async () => {
      vi.mocked(api.products.list).mockResolvedValue({
        ...LIST,
        items: [ROW, { ...ROW, id: 'id-2', title: 'Foil Lid' }],
      })
      let finish: (value: ProductDetail) => void = () => undefined
      details.mockImplementation((id) =>
        id === 'id-2'
          ? new Promise<ProductDetail>((resolve) => {
              finish = resolve
            })
          : Promise.resolve(DETAIL),
      )
      const user = userEvent.setup()
      renderPage('/products/id-1')
      await screen.findByRole('heading', { level: 1, name: 'Hippo Bag' })
      await user.click(screen.getByRole('tab', { name: /^Collections/ }))
      // Nothing about the other product is asked until the box is opened.
      const askedFor = (id: string) => details.mock.calls.some(([asked]) => asked === id)
      expect(askedFor('id-2')).toBe(false)
      await user.click(screen.getByRole('button', { name: 'Add collection' }))

      // Opening the box reads them in the background (nothing is shown until typing)…
      await waitFor(() => expect(askedFor('id-2')).toBe(true))
      expect(list()).toBeNull()
      // …and typing says they are still on their way.
      await user.type(box(), 'range')
      expect(await screen.findByText('Loading collections…')).toBeVisible()

      finish({ ...DETAIL, id: 'id-2', collections: OTHERS } as ProductDetail)
      await waitFor(() => expect(within(list()!).getAllByRole('option')).toHaveLength(10))
      expect(
        screen.getByText('Showing 10 of 12 — keep typing to narrow the list.'),
      ).toBeVisible()
      expect(screen.queryByText('Loading collections…')).toBeNull()
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

    it('says so when nothing matches what was typed', async () => {
      const user = userEvent.setup()
      renderPage('/products/id-1')
      await screen.findByRole('heading', { level: 1, name: 'Hippo Bag' })
      await user.click(screen.getByRole('tab', { name: /^Collections/ }))
      await user.click(screen.getByRole('button', { name: 'Add collection' }))
      expect(list()).toBeNull()

      await user.type(box(), 'zzz')

      expect(
        await screen.findByText(
          'No collection matches “zzz”. Check the name, or paste its ID and press Add.',
        ),
      ).toBeVisible()
    })

    it('adds the clicked collection by its id, shows it by name, and saves it', async () => {
      const user = await openAdd()
      await user.type(box(), 'range 03')
      await user.click(within(list()!).getByRole('option', { name: /Range 03/ }))

      expect(box()).toHaveValue('')
      expect(screen.getByText('Range 03')).toBeInTheDocument()
      expect(screen.getByText('New')).toBeInTheDocument()

      await user.click(saveButton('collections'))
      await confirmUpdate(user)
      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'id-1',
          { collections_add: [OTHERS[2].id] },
          'polymer-uk',
        ),
      )
    })

    it('moves with the arrow keys and adds the highlighted one on Enter; Escape closes only the list', async () => {
      const user = await openAdd()
      await user.type(box(), 'range')

      await user.keyboard('{ArrowDown}{ArrowDown}')
      expect(within(list()!).getByRole('option', { name: /Range 02/ })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      await user.keyboard('{Escape}')
      expect(list()).toBeNull()
      expect(saveButton('collections')).toBeInTheDocument()

      // Clicking the box brings the list back (what was typed is still there).
      await user.click(box())
      expect(list()).not.toBeNull()
      await user.keyboard('{ArrowDown}{Enter}')
      expect(screen.getByText('Range 01')).toBeInTheDocument()
    })

    it('adds a collection by typing its name and pressing Enter or Add', async () => {
      const user = await openAdd()

      // The exact name (any case), no need to click the list.
      await user.type(box(), 'range 04{Enter}')
      expect(box()).toHaveValue('')
      expect(screen.getByText('Range 04')).toBeInTheDocument()

      // Part of a name that narrows to one collection works with the Add button.
      await user.type(box(), 'range 12')
      await user.click(screen.getByRole('button', { name: 'Add' }))
      expect(screen.getByText('Range 12')).toBeInTheDocument()

      await user.click(saveButton('collections'))
      await confirmUpdate(user)
      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'id-1',
          { collections_add: [OTHERS[3].id, OTHERS[11].id] },
          'polymer-uk',
        ),
      )
    })

    it('does not guess when a name fits several collections or none', async () => {
      const user = await openAdd()

      await user.type(box(), 'range 0{Enter}')
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Choose a collection from the list',
      )
      expect(screen.queryByText('New')).toBeNull()

      await user.clear(box())
      await user.type(box(), 'zzz{Enter}')
      expect(screen.getByRole('alert')).toHaveTextContent('No collection is called “zzz”')
      expect(screen.queryByText('New')).toBeNull()
    })

    it('says so when the name is of a collection the product is already in', async () => {
      const user = await openAdd()

      await user.type(box(), 'Best Sellers{Enter}')

      expect(screen.getByRole('alert')).toHaveTextContent(
        'The product is already in that collection',
      )
    })

    it('still takes a pasted ID that is not in the list', async () => {
      const user = await openAdd()
      const id = '3fa85f64-5717-4562-b3fc-2c963f66afa6'

      await user.type(box(), `${id}{Enter}`)

      expect(screen.getByText(id)).toBeInTheDocument()
      expect(screen.getByText('Collection to add')).toBeInTheDocument()
    })
  })

  it('has no Edit pencil on the collections tab: the summary and Add collection only', async () => {
    const user = await openDetails()
    await user.click(screen.getByRole('tab', { name: /^Collections/ }))

    expect(screen.getByText('In 1 collection')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit collections' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save collections' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Add collection' })).toBeInTheDocument()

    // Add collection starts the edit: Save / Discard appear, Add collection stays.
    await user.click(screen.getByRole('button', { name: 'Add collection' }))
    expect(saveButton('collections')).toBeInTheDocument()
    expect(discardButton('collections')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add collection' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit collections' })).toBeNull()
  })

  it('keeps the box on top of the list, and tucks it away when Add collection is clicked again', async () => {
    const user = await openDetails()
    await user.click(screen.getByRole('tab', { name: /^Collections/ }))
    await user.click(screen.getByRole('button', { name: 'Add collection' }))

    const box = screen.getByLabelText('Add to a collection')
    expect(box).toHaveFocus()
    expect(box).toHaveAttribute('placeholder', 'Type a collection name')

    // It sits on top of the list of collections.
    const list = screen.getByRole('list', { name: 'Collections' })
    expect(
      box.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Add collection' }))
    expect(screen.queryByLabelText('Add to a collection')).not.toBeInTheDocument()
  })

  it('opens the editor with the add box on top from "Add collection", and shows added ones first', async () => {
    const user = await openDetails()
    await user.click(screen.getByRole('tab', { name: /^Collections/ }))
    await user.click(screen.getByRole('button', { name: 'Add collection' }))

    const box = screen.getByLabelText('Add to a collection')
    expect(box).toHaveFocus()

    const id = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
    await user.type(box, `${id}{Enter}`)

    const items = within(screen.getByRole('list', { name: 'Collections' })).getAllByRole(
      'listitem',
    )
    expect(items[0]).toHaveTextContent('Collection to add')
    expect(items[1]).toHaveTextContent('Best Sellers')

    await user.click(saveButton('collections'))

    await confirmUpdate(user)
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { collections_add: [id] },
        'polymer-uk',
      ),
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
