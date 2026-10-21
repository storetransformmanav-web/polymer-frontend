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

  async function openPage() {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'Sushi Tray' })
    const block = await screen.findByRole('region', { name: 'Tags' })
    return { user, block }
  }

  const save = () => screen.getByRole('button', { name: 'Save tags' })

  it('shows every tag as a chip in one card, under a "Tags" heading with an add button', async () => {
    const { block } = await openPage()

    expect(within(block).getByRole('heading', { name: 'Tags' })).toBeInTheDocument()
    expect(
      within(block)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(TAGS)
    expect(within(block).getByRole('button', { name: 'Add tags' })).toBeInTheDocument()
  })

  it('sits inside the Product Specifications card, under its fields — not in a card of its own', async () => {
    const { block } = await openPage()

    const card = screen
      .getByRole('heading', { name: 'Product Specifications' })
      .closest('section') as HTMLElement
    expect(within(card).getByRole('region', { name: 'Tags' })).toBe(block)
    // Below the fields.
    expect(within(card).getByText('Vendor / Brand').compareDocumentPosition(block)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  it('is edited on its own: the specifications form does not include the tags', async () => {
    const { user, block } = await openPage()
    await user.click(screen.getByRole('button', { name: 'Edit specifications' }))

    // The specifications are open for editing, the tags are still just chips with the ⊕.
    expect(screen.getByLabelText('Title')).toBeInTheDocument()
    expect(within(block).getByRole('button', { name: 'Add tags' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Add tags' })).not.toBeInTheDocument()
  })

  it('can be open at the same time as the specifications, each saving only its own changes', async () => {
    const { user, block } = await openPage()
    await user.click(screen.getByRole('button', { name: 'Edit specifications' }))
    await user.type(screen.getByLabelText('Vendor'), ' Ltd')
    await user.click(within(block).getByRole('button', { name: 'Add tags' }))
    await user.keyboard('Eco{Enter}')

    // The tag edit survives the specifications form being open, and vice versa.
    expect(within(block).getByText('Eco')).toBeInTheDocument()
    expect(screen.getByLabelText('Vendor')).toHaveValue('Polymer Ltd')

    await user.click(screen.getByRole('button', { name: 'Save specifications' }))

    await confirmUpdate(user)
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'id-1',
        { vendor: 'Polymer Ltd' },
        'polymer-uk',
      ),
    )
    // The half-finished tag edit is untouched by that save.
    expect(within(block).getByText('Eco')).toBeInTheDocument()
    await user.click(save())
    await confirmUpdate(user)
    await waitFor(() =>
      expect(update).toHaveBeenLastCalledWith(
        'id-1',
        { tags_add: ['Eco'] },
        'polymer-uk',
      ),
    )
  })

  it('says so when there are no tags yet, and still lets you add one', async () => {
    details.mockResolvedValue(product([]))
    const { block } = await openPage()

    expect(within(block).getByText('No tags yet.')).toBeInTheDocument()
    expect(within(block).getByRole('button', { name: 'Add tags' })).toBeInTheDocument()
  })

  it('opens the card for editing from the ⊕ button, with the cursor in the box inside the card', async () => {
    const { user, block } = await openPage()
    await user.click(within(block).getByRole('button', { name: 'Add tags' }))

    const box = within(block).getByRole('textbox', { name: 'Add tags' })
    expect(box).toHaveFocus()
    // Every tag has a remove button; Save and Discard replace the ⊕.
    expect(
      within(block).getByRole('button', { name: 'Remove tag Material_Plastic' }),
    ).toBeInTheDocument()
    expect(save()).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Discard tags changes' }),
    ).toBeInTheDocument()
    expect(
      within(block).queryByRole('button', { name: 'Add tags' }),
    ).not.toBeInTheDocument()
  })

  it('adds a tag in the card with Enter, and saves just that addition', async () => {
    const { user, block } = await openPage()
    await user.click(within(block).getByRole('button', { name: 'Add tags' }))
    await user.keyboard('Food Packaging{Enter}')

    expect(within(block).getByText('Food Packaging')).toBeInTheDocument()
    expect(within(block).getByRole('textbox', { name: 'Add tags' })).toHaveValue('')
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
    // Back to the card of chips, now including the new one.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add tags' })).toBeInTheDocument(),
    )
  })

  it('adds several tags at once from commas, ignoring blanks and duplicates', async () => {
    const { user, block } = await openPage()
    await user.click(within(block).getByRole('button', { name: 'Add tags' }))
    await user.keyboard('a, b ,, Material_Plastic, a{Enter}')

    const chips = within(block).getByRole('list', { name: 'Tags' })
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
    const { user, block } = await openPage()
    await user.click(within(block).getByRole('button', { name: 'Add tags' }))
    await user.click(
      within(block).getByRole('button', { name: 'Remove tag Material_Plastic' }),
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
    const { user, block } = await openPage()
    await user.click(within(block).getByRole('button', { name: 'Add tags' }))
    await user.keyboard('{Backspace}')

    expect(
      within(block).queryByText('Category_Sushi Containers & Lids'),
    ).not.toBeInTheDocument()
    expect(within(block).getByText('Material_Plastic')).toBeInTheDocument()
  })

  it('keeps what is typed when the box loses focus', async () => {
    const { user, block } = await openPage()
    await user.click(within(block).getByRole('button', { name: 'Add tags' }))
    await user.keyboard('Half typed')
    await user.click(document.body)

    expect(within(block).getByText('Half typed')).toBeInTheDocument()
  })

  it('throws the changes away on Discard and on Escape, asking the server nothing', async () => {
    const { user, block } = await openPage()
    await user.click(within(block).getByRole('button', { name: 'Add tags' }))
    await user.keyboard('Temporary{Enter}')
    await user.click(screen.getByRole('button', { name: 'Discard tags changes' }))

    expect(within(block).queryByText('Temporary')).not.toBeInTheDocument()
    expect(within(block).getByRole('button', { name: 'Add tags' })).toBeInTheDocument()

    await user.click(within(block).getByRole('button', { name: 'Add tags' }))
    await user.keyboard('Another{Enter}{Escape}')
    expect(within(block).queryByText('Another')).not.toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
  })

  it("stays open with the backend's message when saving fails", async () => {
    update.mockRejectedValue(new ApiError('Too many tags.', { status: 422 }))
    const { user, block } = await openPage()
    await user.click(within(block).getByRole('button', { name: 'Add tags' }))
    await user.keyboard('One more{Enter}')
    await user.click(save())
    await confirmUpdate(user)

    expect(await screen.findByText('Too many tags.')).toBeInTheDocument()
    expect(within(block).getByText('One more')).toBeInTheDocument()
    expect(save()).toBeEnabled()
  })
})
