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
  title: 'Sushi Tray',
  handle: 'sushi-tray',
  status: 'ACTIVE',
  vendor: 'Polymer',
  product_type: 'Trays',
  category_name: null,
  tags: [],
  image_url: null,
  price_min: '9.50',
  price_max: '9.50',
  currency: 'GBP',
  variants_count: 0,
  total_inventory: 5,
  shopify_created_at: null,
  shopify_updated_at: null,
  synced_at: '2026-01-01T00:00:00Z',
} satisfies ProductListItem

function product(tags: string[]) {
  return {
    shop: SHOP,
    id: 'id-1',
    shopify_id: 1,
    title: 'Sushi Tray',
    handle: 'sushi-tray',
    description_html: '',
    status: 'ACTIVE',
    vendor: 'Polymer',
    product_type: 'Trays',
    category: null,
    tags,
    template_suffix: '',
    seo: { title: null, description: null },
    currency: 'GBP',
    price_range: { min: '9.50', max: '9.50', currency: 'GBP' },
    compare_at_price_range: null,
    featured_image_url: null,
    total_inventory: 5,
    variants_count: 0,
    options: [],
    images: [],
    variants: [],
    collections: [],
    metafields: [],
  } as unknown as ProductDetail
}

const TAGS = ['Material_Plastic', 'Category_Sushi Containers & Lids']

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
  changes: null,
  message: 'Saved.',
}

const list = vi.mocked(api.products.list)
const details = vi.mocked(api.products.details)
const update = vi.mocked(api.products.update)
const syncHistory = vi.mocked(api.products.syncHistory)

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/products/*" element={<ProductsPage />} />
    </Routes>,
    { route: '/products/id-1' },
  )
}

describe('the Tags block on the product page', () => {
  beforeEach(() => {
    list.mockResolvedValue(LIST)
    details.mockResolvedValue(product(TAGS))
    update.mockResolvedValue(WRITE_OK)
    syncHistory.mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // The Tags block is re-created when the specifications card switches to its form.
  const block = () => screen.getByRole('region', { name: 'Tags' })
  const tagBox = () => within(block()).getByRole('textbox', { name: 'Add tags' })
  const save = () => screen.getByRole('button', { name: 'Save specifications' })
  const discard = () =>
    screen.getByRole('button', { name: 'Discard specifications changes' })

  async function openPage() {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Sushi Tray' })
    await screen.findByRole('region', { name: 'Tags' })
    return user
  }

  /** The specifications pencil: the only way to change the tags. */
  async function startEditing(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Edit specifications' }))
    await user.click(tagBox())
  }

  it('shows every tag as a chip in one card, under a "Tags" heading, with no add option', async () => {
    await openPage()

    expect(within(block()).getByRole('heading', { name: 'Tags' })).toBeInTheDocument()
    expect(
      within(block())
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(TAGS)
    expect(screen.queryByRole('button', { name: 'Add tags' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Add tags' })).not.toBeInTheDocument()
  })

  it('sits inside the Product Specifications card, under its fields — not in a card of its own', async () => {
    await openPage()

    const card = screen
      .getByRole('heading', { name: 'Product Specifications' })
      .closest('section') as HTMLElement
    expect(within(card).getByRole('region', { name: 'Tags' })).toBe(block())
    // Below the fields.
    expect(
      within(card).getByText('Vendor / Brand').compareDocumentPosition(block()),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('shows the add-tags box only while the specifications are being edited', async () => {
    const user = await openPage()
    await user.click(screen.getByRole('button', { name: 'Edit specifications' }))

    // The same card: the specification fields and the tags box are open together.
    expect(screen.getByLabelText('Title')).toBeInTheDocument()
    expect(tagBox()).toBeInTheDocument()
    expect(
      within(block()).getByRole('button', { name: 'Remove tag Material_Plastic' }),
    ).toBeInTheDocument()

    await user.click(discard())
    expect(screen.queryByRole('textbox', { name: 'Add tags' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Remove tag/ })).not.toBeInTheDocument()
  })

  it('says so when there are no tags yet, and the box is there once editing', async () => {
    details.mockResolvedValue(product([]))
    const user = await openPage()

    expect(within(block()).getByText('No tags yet.')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Add tags' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit specifications' }))
    expect(tagBox()).toBeInTheDocument()
  })

  it('is saved together with the specifications, in one update', async () => {
    const user = await openPage()
    await startEditing(user)
    await user.type(screen.getByLabelText('Vendor'), ' Ltd')
    await user.type(tagBox(), 'Eco{Enter}')

    expect(within(block()).getByText('Eco')).toBeInTheDocument()
    expect(screen.getByLabelText('Vendor')).toHaveValue('Polymer Ltd')

    await user.click(save())
    await confirmUpdate(user)
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { vendor: 'Polymer Ltd', tags_add: ['Eco'] },
        'polymer-uk',
      ),
    )
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('adds a tag with Enter, and saves just that addition', async () => {
    const user = await openPage()
    await startEditing(user)
    expect(save()).toBeDisabled()
    await user.keyboard('Food Packaging{Enter}')

    expect(within(block()).getByText('Food Packaging')).toBeInTheDocument()
    expect(tagBox()).toHaveValue('')
    expect(save()).toBeEnabled()
    await user.click(save())
    await confirmUpdate(user)

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { tags_add: ['Food Packaging'] },
        'polymer-uk',
      ),
    )
    // Back to the card of chips, with no box.
    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: 'Add tags' })).not.toBeInTheDocument(),
    )
  })

  it('adds several tags at once from commas, ignoring blanks and duplicates', async () => {
    const user = await openPage()
    await startEditing(user)
    await user.keyboard('a, b ,, Material_Plastic, a{Enter}')

    const chips = within(block()).getByRole('list', { name: 'Tags' })
    expect(
      within(chips)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([...TAGS, 'a', 'b'])
    await user.click(save())
    await confirmUpdate(user)
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('id-1', { tags_add: ['a', 'b'] }, 'polymer-uk'),
    )
  })

  it('removes a tag with its ✕, saved as a removal only', async () => {
    const user = await openPage()
    await user.click(screen.getByRole('button', { name: 'Edit specifications' }))
    await user.click(
      within(block()).getByRole('button', { name: 'Remove tag Material_Plastic' }),
    )
    await user.click(save())
    await confirmUpdate(user)

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { tags_remove: ['Material_Plastic'] },
        'polymer-uk',
      ),
    )
  })

  it('removes the last tag with Backspace in the empty box', async () => {
    const user = await openPage()
    await startEditing(user)
    await user.keyboard('{Backspace}')

    expect(
      within(block()).queryByText('Category_Sushi Containers & Lids'),
    ).not.toBeInTheDocument()
    expect(within(block()).getByText('Material_Plastic')).toBeInTheDocument()
  })

  it('keeps what is typed when the box loses focus', async () => {
    const user = await openPage()
    await startEditing(user)
    await user.keyboard('Half typed')
    await user.click(document.body)

    expect(within(block()).getByText('Half typed')).toBeInTheDocument()
  })

  it('throws the changes away on Discard and on Escape, asking the server nothing', async () => {
    const user = await openPage()
    await startEditing(user)
    await user.keyboard('Temporary{Enter}')
    await user.click(discard())

    expect(within(block()).queryByText('Temporary')).not.toBeInTheDocument()

    await startEditing(user)
    await user.keyboard('Another{Enter}{Escape}')
    expect(within(block()).queryByText('Another')).not.toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
  })

  it("stays open with the backend's message when saving fails", async () => {
    update.mockRejectedValue(new ApiError('Too many tags.', { status: 422 }))
    const user = await openPage()
    await startEditing(user)
    await user.keyboard('One more{Enter}')
    await user.click(save())
    await confirmUpdate(user)

    expect(await screen.findByText('Too many tags.')).toBeInTheDocument()
    expect(within(block()).getByText('One more')).toBeInTheDocument()
    expect(save()).toBeEnabled()
  })
})
