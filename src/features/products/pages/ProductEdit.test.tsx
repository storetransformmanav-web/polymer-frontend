import { screen, waitFor, within } from '@testing-library/react'
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
    it('has View and Delete in every row under an Actions column — no Edit pencil', async () => {
      renderPage()
      await screen.findByText('Hippo Bag')

      expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'View Hippo Bag' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Delete Hippo Bag' })).toBeInTheDocument()
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

    for (const what of ['specifications', 'status', 'description']) {
      expect(pencil(what)).toBeInTheDocument()
    }
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

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { title: 'Hippo Carrier Bag' },
        'polymer-uk',
      ),
    )
    // Back to read-only — and no dialog came or went.
    await waitFor(() => expect(pencil('specifications')).toBeInTheDocument())
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
    expect(await screen.findByText(/Saved “Hippo Carrier Bag”/)).toBeInTheDocument()
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

  it('edits the status, the description and the search listing as separate saves', async () => {
    const user = await openDetails()

    await user.click(pencil('status'))
    await user.selectOptions(screen.getByLabelText('Status'), 'DRAFT')
    await user.click(saveButton('status'))
    await waitFor(() =>
      expect(update).toHaveBeenLastCalledWith('id-1', { status: 'DRAFT' }, 'polymer-uk'),
    )

    await user.click(pencil('description'))
    // The rich-text editor loads on demand; its raw HTML view is a plain text box.
    await user.click(await screen.findByRole('button', { name: 'Edit HTML' }))
    const description = screen.getByLabelText('Description (HTML)')
    await user.clear(description)
    await user.type(description, 'Brand new copy')
    await user.click(saveButton('description'))
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
    await waitFor(() =>
      expect(update).toHaveBeenLastCalledWith(
        'id-1',
        { seo: { title: 'Hippo carrier bag', description: '' } },
        'polymer-uk',
      ),
    )
    expect(update).toHaveBeenCalledTimes(3)
  })

  it('edits two sections at once without one touching the other', async () => {
    const user = await openDetails()
    await user.click(pencil('specifications'))
    await user.click(pencil('description'))
    await user.click(await screen.findByRole('button', { name: 'Edit HTML' }))
    await user.type(screen.getByLabelText('Description (HTML)'), ' — extra')

    await user.type(screen.getByLabelText('Vendor'), ' Ltd')
    await user.click(saveButton('specifications'))

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

  it('edits the collections tab in place', async () => {
    const user = await openDetails()
    await user.click(screen.getByRole('tab', { name: /^Collections/ }))
    await user.click(pencil('collections'))
    await user.click(screen.getByRole('button', { name: 'Remove from Best Sellers' }))
    await user.click(saveButton('collections'))

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { collections_remove: ['col1'] },
        'polymer-uk',
      ),
    )
  })

  it('puts the summary, Edit and Add collection together in the collections header', async () => {
    const user = await openDetails()
    await user.click(screen.getByRole('tab', { name: /^Collections/ }))

    expect(screen.getByText('In 1 collection')).toBeInTheDocument()
    expect(pencil('collections')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add collection' })).toBeInTheDocument()

    // While editing, Save / Discard replace the pencil; Add collection stays.
    await user.click(pencil('collections'))
    expect(saveButton('collections')).toBeInTheDocument()
    expect(discardButton('collections')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add collection' })).toBeInTheDocument()
  })

  it('keeps the add-by-ID box hidden while editing until "Add collection" is clicked', async () => {
    const user = await openDetails()
    await user.click(screen.getByRole('tab', { name: /^Collections/ }))
    await user.click(pencil('collections'))

    expect(screen.queryByLabelText('Add to a collection by ID')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add collection' }))
    const box = screen.getByLabelText('Add to a collection by ID')
    expect(box).toHaveFocus()

    // It sits on top of the list of collections.
    const list = screen.getByRole('list', { name: 'Collections' })
    expect(
      box.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    // Clicking again tucks it away.
    await user.click(screen.getByRole('button', { name: 'Add collection' }))
    expect(screen.queryByLabelText('Add to a collection by ID')).not.toBeInTheDocument()
  })

  it('opens the editor with the add box on top from "Add collection", and shows added ones first', async () => {
    const user = await openDetails()
    await user.click(screen.getByRole('tab', { name: /^Collections/ }))
    await user.click(screen.getByRole('button', { name: 'Add collection' }))

    const box = screen.getByLabelText('Add to a collection by ID')
    expect(box).toHaveFocus()

    const id = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
    await user.type(box, `${id}{Enter}`)

    const items = within(screen.getByRole('list', { name: 'Collections' })).getAllByRole(
      'listitem',
    )
    expect(items[0]).toHaveTextContent('Collection to add')
    expect(items[1]).toHaveTextContent('Best Sellers')

    await user.click(saveButton('collections'))
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { collections_add: [id] },
        'polymer-uk',
      ),
    )
  })

  it('does not show the add box when editing starts from the pencil', async () => {
    const user = await openDetails()
    await user.click(screen.getByRole('tab', { name: /^Collections/ }))
    await user.click(pencil('collections'))

    expect(screen.queryByLabelText('Add to a collection by ID')).not.toBeInTheDocument()
  })

  it('edits the media tab in place', async () => {
    const user = await openDetails()
    await user.click(screen.getByRole('tab', { name: /^Media/ }))
    await user.click(pencil('media'))
    await user.click(screen.getByRole('button', { name: 'Move image 2 up' }))
    await user.click(saveButton('media'))

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

    // Both the header and the specifications show it — patched into the cache at once.
    expect((await screen.findAllByText('Acme Packaging')).length).toBeGreaterThanOrEqual(
      2,
    )
    expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument()
  })
})
