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
  type ProductUpdateBody,
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
    auth: {},
  },
}))

// Editing a section loads the rich-text editor (TipTap) on demand: give slow machines room.
vi.setConfig({ testTimeout: 20_000 })

const SHOP = {
  key: 'polymer-uk',
  name: 'Polymer UK',
  domain: 'polymer-uk-ltd.myshopify.com',
  currency: 'GBP',
}

const ROW = {
  shop: SHOP,
  id: 'id-1',
  shopify_id: 1,
  title: 'Hippo Bag',
  handle: 'hippo-bag',
  status: 'ACTIVE',
  vendor: 'Polymer',
  product_type: 'Bags',
  category_name: null,
  tags: [],
  image_url: null,
  price_min: '25.85',
  price_max: '25.85',
  currency: 'GBP',
  variants_count: 1,
  total_inventory: 5,
  shopify_created_at: null,
  shopify_updated_at: null,
  synced_at: '2026-01-01T00:00:00Z',
} as ProductListItem

const SETTINGS = {
  accordian_multi: false,
  border_color: '#e2e2e2',
  sections: [
    {
      title: 'Product Description',
      content: '<p>Dependable containers.</p>',
      position: 0,
      chosen: false,
    },
    {
      title: 'Product Information',
      content: '<table><tbody><tr><td>MC01H</td><td>500ml</td></tr></tbody></table>',
      position: 1,
      chosen: false,
    },
  ],
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
  tags: [],
  template_suffix: '',
  has_only_default_variant: true,
  has_out_of_stock_variants: false,
  total_inventory: 5,
  tracks_inventory: true,
  requires_selling_plan: false,
  gift_card: false,
  seo: { title: null, description: null },
  online_store_url: null,
  currency: 'GBP',
  price_range: { min: '25.85', max: '25.85', currency: 'GBP' },
  compare_at_price_range: null,
  featured_image_url: null,
  variants_count: 0,
  media_count: 0,
  published_at: null,
  shopify_created_at: null,
  shopify_updated_at: null,
  synced_at: '2026-01-01T00:00:00Z',
  options: [],
  images: [],
  variants: [],
  collections: [],
  metafields: [
    {
      namespace: 'apd',
      key: 'apd',
      type: 'json_string',
      value: JSON.stringify(SETTINGS),
    },
  ],
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
  changes: { metafields: 'apd.apd' },
  message: 'Saved. Sending to the store.',
}

const list = vi.mocked(api.products.list)
const details = vi.mocked(api.products.details)
const update = vi.mocked(api.products.update)
const syncHistory = vi.mocked(api.products.syncHistory)

const WHAT = 'product details'
const pencil = () => screen.getByRole('button', { name: `Edit ${WHAT}` })
const save = () => screen.getByRole('button', { name: `Save ${WHAT}` })
const discard = () => screen.getByRole('button', { name: `Discard ${WHAT} changes` })

/** The apd settings the last update sent. */
function sentSettings() {
  const body = update.mock.calls.at(-1)?.[1] as ProductUpdateBody
  expect(body.metafields).toHaveLength(1)
  expect(Object.keys(body)).toEqual(['metafields'])
  const [field] = body.metafields!
  expect(field).toMatchObject({ namespace: 'apd', key: 'apd', type: 'json_string' })
  return JSON.parse(field.value) as typeof SETTINGS
}

async function openDetails() {
  const user = userEvent.setup()
  renderWithProviders(
    <Routes>
      <Route path="/products/*" element={<ProductsPage />} />
    </Routes>,
    { route: '/products/id-1' },
  )
  await screen.findByRole('heading', { level: 1, name: 'Hippo Bag' })
  return user
}

describe('editing the description sections (metafield apd)', () => {
  beforeEach(() => {
    list.mockResolvedValue(LIST)
    details.mockResolvedValue(DETAIL)
    update.mockResolvedValue(WRITE_OK)
    syncHistory.mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('puts both sections in one “Product Details” card, with one pencil, the rows closed', async () => {
    const user = await openDetails()

    expect(screen.getByRole('button', { name: /^Product Details/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(pencil()).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Edit product/ })).toHaveLength(1)
    expect(screen.getByRole('button', { name: /^Product Information/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.getByRole('button', { name: /^Product Description/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Product Information/ }))
    expect(
      within(screen.getByRole('region', { name: 'Product Information' })).getByRole(
        'table',
      ),
    ).toBeInTheDocument()
  })

  it('has no card at all for a product without sections', async () => {
    details.mockResolvedValue({ ...DETAIL, metafields: [] })
    await openDetails()

    expect(screen.queryByRole('button', { name: `Edit ${WHAT}` })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Product Details/ })).toBeNull()
  })

  it('edits a title and sends only the apd metafield — the rest of its settings kept', async () => {
    // Once saved, the backend answers with the new metafield.
    update.mockImplementation(async (_id, body) => {
      details.mockResolvedValue({
        ...DETAIL,
        metafields: body.metafields ?? [],
      } as ProductDetail)
      return WRITE_OK
    })
    const user = await openDetails()
    await user.click(pencil())

    const titles = screen.getAllByLabelText(/^Title/)
    expect(titles.map((input) => (input as HTMLInputElement).value)).toEqual([
      'Product Description',
      'Product Information',
    ])
    await user.clear(titles[1])
    await user.type(titles[1], 'Specifications')
    expect(update).not.toHaveBeenCalled()

    await user.click(save())
    await confirmUpdate(user)

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(update.mock.calls[0][0]).toBe('id-1')
    expect(update.mock.calls[0][2]).toBe('polymer-uk')
    const settings = sentSettings()
    expect(settings).toEqual({
      ...SETTINGS,
      sections: [
        SETTINGS.sections[0],
        { ...SETTINGS.sections[1], title: 'Specifications', position: 1 },
      ],
    })
    // Back to the accordion, with the new title at once.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: `Save ${WHAT}` })).toBeNull(),
    )
    expect(
      await screen.findByRole('button', { name: /^Specifications/ }),
    ).toBeInTheDocument()
  })

  it('edits a section’s text in the rich-text editor, through its HTML view', async () => {
    const user = await openDetails()
    await user.click(pencil())

    const editButtons = await screen.findAllByRole('button', { name: 'Edit HTML' })
    await user.click(editButtons[0])
    const html = await screen.findByLabelText('Product Description text (HTML)')
    await user.clear(html)
    await user.type(html, 'Brand new copy')
    await user.click(save())
    await confirmUpdate(user)

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    const settings = sentSettings()
    expect(settings.sections[0].content).toBe('Brand new copy')
    // The untouched section's HTML goes back exactly as it was.
    expect(settings.sections[1].content).toBe(SETTINGS.sections[1].content)
  })

  it('moves, adds and removes sections, and numbers the order', async () => {
    const user = await openDetails()
    await user.click(pencil())

    await user.click(screen.getByRole('button', { name: 'Move Product Information up' }))
    await user.click(screen.getByRole('button', { name: 'Add section' }))
    const titles = screen.getAllByLabelText(/^Title/)
    expect(titles).toHaveLength(3)
    await user.type(titles[2], 'Delivery')
    await user.click(screen.getByRole('button', { name: 'Remove Product Description' }))
    await user.click(save())
    await confirmUpdate(user)

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(
      sentSettings().sections.map((section) => [section.title, section.position]),
    ).toEqual([
      ['Product Information', 0],
      ['Delivery', 1],
    ])
  })

  it('keeps at least one section, and the move buttons stop at the ends', async () => {
    const user = await openDetails()
    await user.click(pencil())

    expect(
      screen.getByRole('button', { name: 'Move Product Description up' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Move Product Information down' }),
    ).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Remove Product Description' }))
    expect(
      screen.getByRole('button', { name: 'Remove Product Information' }),
    ).toBeDisabled()
  })

  it('needs a title for every section, and sends nothing until it has them', async () => {
    const user = await openDetails()
    await user.click(pencil())
    await user.click(screen.getByRole('button', { name: 'Add section' }))
    // Something changed, but the new section has no title.
    await user.click(save())
    await confirmUpdate(user)

    expect(screen.getByText('Enter a title')).toBeInTheDocument()
    expect(screen.getByText('Fix the highlighted fields to save.')).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
  })

  it('does not offer Save until something changed, and Discard leaves everything as it was', async () => {
    const user = await openDetails()
    await user.click(pencil())
    expect(save()).toBeDisabled()

    await user.type(screen.getAllByLabelText(/^Title/)[0], ' (new)')
    expect(save()).toBeEnabled()
    await user.click(discard())

    expect(update).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: /^Product Description$/ }),
    ).toBeInTheDocument()
  })

  it('asks first, and does nothing on Cancel', async () => {
    const user = await openDetails()
    await user.click(pencil())
    await user.type(screen.getAllByLabelText(/^Title/)[0], ' (new)')
    await user.click(save())

    const dialog = await screen.findByRole('alertdialog')
    expect(update).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(update).not.toHaveBeenCalled()
    // The edit is still open with what was typed.
    expect(screen.getAllByLabelText(/^Title/)[0]).toHaveValue('Product Description (new)')
  })

  it('shows the backend’s message and keeps the edit when the save fails', async () => {
    update.mockRejectedValue(
      new ApiError('Shopify refused the metafield.', { status: 422 }),
    )
    const user = await openDetails()
    await user.click(pencil())
    await user.type(screen.getAllByLabelText(/^Title/)[0], ' (new)')
    await user.click(save())
    await confirmUpdate(user)

    expect(await screen.findByText('Shopify refused the metafield.')).toBeInTheDocument()
    expect(screen.getAllByLabelText(/^Title/)[0]).toHaveValue('Product Description (new)')
  })
})
