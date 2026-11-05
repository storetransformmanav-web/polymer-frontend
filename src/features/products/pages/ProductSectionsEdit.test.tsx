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
import { DEFAULT_APD_SETTINGS } from '../utils/descriptionSections.ts'
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

const WHAT = 'description'
const pencil = () => screen.getByRole('button', { name: `Edit ${WHAT}` })
const save = () => screen.getByRole('button', { name: `Save ${WHAT}` })
const discard = () => screen.getByRole('button', { name: `Discard ${WHAT} changes` })

/** The apd settings the last update sent. */
function sentSettings() {
  const body = update.mock.calls.at(-1)?.[1] as ProductUpdateBody
  expect(body.metafields).toHaveLength(1)
  expect(Object.keys(body)).toEqual(['metafields'])
  const [field] = body.metafields!
  expect(field).toMatchObject({ namespace: 'apd', key: 'apd', type: 'json' })
  return JSON.parse(field.value) as typeof SETTINGS
}

/** Opens a section's raw-HTML view (the plain box tests type into) and returns that box. */
async function openHtml(
  user: ReturnType<typeof userEvent.setup>,
  title: 'Product Description' | 'Product Information',
) {
  const group = await screen.findByRole('group', { name: title })
  await user.click(await within(group).findByRole('button', { name: 'Edit HTML' }))
  return screen.findByLabelText(`${title} text (HTML)`)
}

/** Types into a section's raw-HTML view. */
async function typeInto(
  user: ReturnType<typeof userEvent.setup>,
  title: 'Product Description' | 'Product Information',
  text: string,
) {
  await user.type(await openHtml(user, title), text)
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

  it('shows both sections on their own, with one pencil above them and the rows closed', async () => {
    const user = await openDetails()

    // No "Description" card around them.
    expect(screen.queryByRole('button', { name: /^Description/ })).toBeNull()
    expect(pencil()).toBeInTheDocument()
    // One pencil for the sections (the specifications have their own).
    expect(screen.getAllByRole('button', { name: /^Edit desc/ })).toHaveLength(1)
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

  it('shows the product’s own description instead for a product without sections, and offers to add them', async () => {
    details.mockResolvedValue({ ...DETAIL, metafields: [] })
    await openDetails()

    // The same Description card, but with the plain description (and no accordion rows).
    expect(screen.getByRole('button', { name: /^Description/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Product Information/ })).toBeNull()
    // Under it, a card to add the sections — and no second pencil above that card.
    const empty = screen.getByRole('region', {
      name: 'Product description & information',
    })
    expect(within(empty).getByText(/No sections yet/)).toBeInTheDocument()
    expect(
      within(empty).getByRole('button', { name: 'Add sections' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit description sections' })).toBeNull()
  })

  it('adds the first sections to a product without any: one PUT with a new apd metafield', async () => {
    details.mockResolvedValue({ ...DETAIL, metafields: [] })
    update.mockImplementation(async (_id, body) => {
      details.mockResolvedValue({
        ...DETAIL,
        metafields: body.metafields ?? [],
      } as ProductDetail)
      return WRITE_OK
    })
    const user = await openDetails()

    await user.click(screen.getByRole('button', { name: 'Add sections' }))
    expect(screen.getByText('Adding description sections')).toBeInTheDocument()
    // Two fixed editors, nothing to title, add or remove.
    expect(screen.queryAllByLabelText(/^Title/)).toHaveLength(0)
    await typeInto(user, 'Product Description', '<p>Strong box.</p>')
    await typeInto(user, 'Product Information', '<p>100 x 75 mm</p>')
    expect(update).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Save description sections' }))
    await confirmUpdate(user)

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    const body = update.mock.calls[0][1]
    expect(Object.keys(body)).toEqual(['metafields'])
    expect(body.metafields).toHaveLength(1)
    expect(body.metafields?.[0]).toMatchObject({
      namespace: 'apd',
      key: 'apd',
      type: 'json',
    })
    expect(JSON.parse(body.metafields?.[0].value ?? '')).toEqual({
      ...DEFAULT_APD_SETTINGS,
      sections: [
        {
          title: 'Product Description',
          content: '<p>Strong box.</p>',
          position: 0,
          chosen: false,
          selected: false,
        },
        {
          title: 'Product Information',
          content: '<p>100 x 75 mm</p>',
          position: 1,
          chosen: false,
          selected: false,
        },
      ],
    })

    // The accordion replaces the empty card at once.
    expect(
      await screen.findByRole('button', { name: /^Product Information/ }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Product description & information' }),
    ).toBeNull()
  })

  it('Discard puts the empty card back, and nothing is sent', async () => {
    details.mockResolvedValue({ ...DETAIL, metafields: [] })
    const user = await openDetails()

    await user.click(screen.getByRole('button', { name: 'Add sections' }))
    await typeInto(user, 'Product Description', 'Some text')
    await user.click(
      screen.getByRole('button', { name: 'Discard description sections changes' }),
    )
    expect(update).not.toHaveBeenCalled()
    expect(
      screen.getByRole('region', { name: 'Product description & information' }),
    ).toBeInTheDocument()
  })

  it('offers nothing over a sections metafield it cannot read', async () => {
    details.mockResolvedValue({
      ...DETAIL,
      metafields: [{ ...DETAIL.metafields[0], value: '{not json' }],
    } as ProductDetail)
    await openDetails()

    expect(screen.getByRole('button', { name: /^Description/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add sections' })).toBeNull()
  })

  it('is just two text editors with fixed titles: no title boxes, no add, move or remove', async () => {
    const user = await openDetails()
    await user.click(pencil())

    expect(screen.getByRole('group', { name: 'Product Description' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Product Information' })).toBeInTheDocument()
    expect(screen.queryAllByLabelText(/^Title/)).toHaveLength(0)
    for (const name of [/^Add section/, /^Move /, /^Remove /, /^Delete all/]) {
      expect(screen.queryByRole('button', { name })).toBeNull()
    }
  })

  it('edits a section’s text in the rich-text editor, through its HTML view', async () => {
    const user = await openDetails()
    await user.click(pencil())

    const html = await openHtml(user, 'Product Description')
    await user.clear(html)
    await user.type(html, 'Brand new copy')
    await user.click(save())
    await confirmUpdate(user)

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    // Everything else of the metafield — its settings, the titles, the other section's HTML and
    // each section's own keys — goes back exactly as it was.
    expect(sentSettings()).toEqual({
      ...SETTINGS,
      sections: [
        { ...SETTINGS.sections[0], content: 'Brand new copy' },
        SETTINGS.sections[1],
      ],
    })
  })

  it('keeps a section it does not show, and adds a missing one at the end', async () => {
    const withDelivery = {
      ...SETTINGS,
      sections: [
        SETTINGS.sections[0],
        { title: 'Delivery', content: '<p>2 days</p>', position: 1, chosen: false },
      ],
    }
    details.mockResolvedValue({
      ...DETAIL,
      metafields: [{ ...DETAIL.metafields[0], value: JSON.stringify(withDelivery) }],
    } as ProductDetail)
    const user = await openDetails()
    await user.click(pencil())
    expect(
      screen.getByText('1 other section on this product is kept as it is.'),
    ).toBeInTheDocument()

    await typeInto(user, 'Product Information', '<p>Sizes</p>')
    await user.click(save())
    await confirmUpdate(user)

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    const sent = sentSettings()
    expect(sent.sections.map((section) => [section.title, section.position])).toEqual([
      ['Product Description', 0],
      ['Delivery', 1],
      ['Product Information', 2],
    ])
    expect(sent.sections[1]).toEqual({ ...withDelivery.sections[1], position: 1 })
  })

  it('does not offer Save until something changed, and Discard leaves everything as it was', async () => {
    const user = await openDetails()
    await user.click(pencil())
    expect(save()).toBeDisabled()

    await typeInto(user, 'Product Description', ' (new)')
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
    const html = await openHtml(user, 'Product Description')
    await user.type(html, ' (new)')
    await user.click(save())

    const dialog = await screen.findByRole('alertdialog')
    expect(update).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(update).not.toHaveBeenCalled()
    // The edit is still open with what was typed.
    expect((html as HTMLTextAreaElement).value).toContain('(new)')
  })

  it('shows the backend’s message and keeps the edit when the save fails', async () => {
    update.mockRejectedValue(
      new ApiError('Shopify refused the metafield.', { status: 422 }),
    )
    const user = await openDetails()
    await user.click(pencil())
    const html = await openHtml(user, 'Product Description')
    await user.type(html, ' (new)')
    await user.click(save())
    await confirmUpdate(user)

    expect(await screen.findByText('Shopify refused the metafield.')).toBeInTheDocument()
    expect((html as HTMLTextAreaElement).value).toContain('(new)')
  })
})
