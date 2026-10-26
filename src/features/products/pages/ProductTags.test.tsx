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
  // The tags seen on the list: what the tag box suggests while typing.
  tags: [
    'Material_Foil',
    'Material_Glass',
    'Material_Plastic',
    'Category_Food Packaging',
  ],
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
  const tagBox = () => within(block()).getByRole('combobox', { name: 'Add tags' })
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
    expect(screen.queryByRole('combobox', { name: 'Add tags' })).not.toBeInTheDocument()
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
    expect(screen.queryByRole('combobox', { name: 'Add tags' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Remove tag/ })).not.toBeInTheDocument()
  })

  it('says so when there are no tags yet, and the box is there once editing', async () => {
    details.mockResolvedValue(product([]))
    const user = await openPage()

    expect(within(block()).getByText('No tags yet.')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Add tags' })).not.toBeInTheDocument()
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
      expect(
        screen.queryByRole('combobox', { name: 'Add tags' }),
      ).not.toBeInTheDocument(),
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

  describe('suggestions while typing', () => {
    const suggestions = () => screen.queryByRole('listbox', { name: 'Matching tags' })
    const optionNames = () =>
      within(suggestions()!)
        .getAllByRole('option')
        .map((option) => option.textContent)

    it('lists every matching tag from the store under the box, leaving out the ones already on the product', async () => {
      const user = await openPage()
      await startEditing(user)
      expect(suggestions()).toBeNull()

      await user.keyboard('mat')

      // Material_Plastic is already a chip, so only the others are offered.
      expect(optionNames()).toEqual(['Material_Foil', 'Material_Glass'])
      await user.keyboard('erial_f')
      expect(optionNames()).toEqual(['Material_Foil'])
      // Nothing matching: no list at all.
      await user.keyboard('zzz')
      expect(suggestions()).toBeNull()
    })

    it('adds the clicked suggestion without leaving the half-typed text behind as a tag', async () => {
      const user = await openPage()
      await startEditing(user)
      await user.keyboard('foil')

      await user.click(
        within(suggestions()!).getByRole('option', { name: 'Material_Foil' }),
      )

      expect(within(block()).getByText('Material_Foil')).toBeInTheDocument()
      expect(within(block()).queryByText('foil')).not.toBeInTheDocument()
      expect(tagBox()).toHaveValue('')
      expect(tagBox()).toHaveFocus()
      expect(suggestions()).toBeNull()

      await user.click(save())
      await confirmUpdate(user)
      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          'id-1',
          { tags_add: ['Material_Foil'] },
          'polymer-uk',
        ),
      )
    })

    it('moves with the arrow keys and adds the highlighted one on Enter', async () => {
      const user = await openPage()
      await startEditing(user)
      await user.keyboard('mat{ArrowDown}{ArrowDown}')

      expect(
        within(suggestions()!).getByRole('option', { name: 'Material_Glass' }),
      ).toHaveAttribute('aria-selected', 'true')
      await user.keyboard('{Enter}')

      expect(within(block()).getByText('Material_Glass')).toBeInTheDocument()
      expect(suggestions()).toBeNull()
    })

    it('still adds what was typed on Enter when no suggestion is highlighted', async () => {
      const user = await openPage()
      await startEditing(user)

      await user.keyboard('mat{Enter}')

      expect(within(block()).getByText('mat')).toBeInTheDocument()
    })

    it('closes the list on Escape without leaving the edit, and brings it back when typing again', async () => {
      const user = await openPage()
      await startEditing(user)
      await user.keyboard('mat')
      expect(suggestions()).not.toBeNull()

      await user.keyboard('{Escape}')
      expect(suggestions()).toBeNull()
      // Still editing: the box and the Save button are there, nothing was discarded.
      expect(tagBox()).toHaveValue('mat')
      expect(save()).toBeInTheDocument()

      await user.keyboard('e')
      expect(suggestions()).not.toBeNull()
    })

    describe('while the page scrolls', () => {
      let box = { top: 300, bottom: 340 }
      const original = HTMLElement.prototype.getBoundingClientRect

      beforeEach(() => {
        box = { top: 300, bottom: 340 }
        // jsdom lays nothing out: give the tag box a place on the screen, and let tests move it.
        HTMLElement.prototype.getBoundingClientRect = function () {
          if (this.className.toString().includes('cursor-text')) {
            return {
              ...box,
              left: 40,
              right: 640,
              width: 600,
              height: box.bottom - box.top,
              x: 40,
              y: box.top,
              toJSON: () => ({}),
            }
          }
          return original.call(this)
        }
      })

      afterEach(() => {
        HTMLElement.prototype.getBoundingClientRect = original
      })

      it('stays open and follows its box instead of closing', async () => {
        const user = await openPage()
        await startEditing(user)
        await user.keyboard('mat')
        expect(suggestions()).toHaveStyle({ top: '344px', width: '600px' })

        // The page scrolls: the box moves up 80px, and the list goes with it.
        box = { top: 220, bottom: 260 }
        fireEvent.scroll(window)
        expect(suggestions()).not.toBeNull()
        expect(suggestions()).toHaveStyle({ top: '264px' })

        // Typing on, after the scroll, still works with the list open.
        await user.keyboard('erial_f')
        expect(optionNames()).toEqual(['Material_Foil'])
      })

      it('is not closed by scrolling the list itself', async () => {
        const user = await openPage()
        await startEditing(user)
        await user.keyboard('mat')

        fireEvent.scroll(suggestions()!)

        expect(suggestions()).not.toBeNull()
      })

      it('is hidden only while its box is scrolled out of view, and returns with it', async () => {
        const user = await openPage()
        await startEditing(user)
        await user.keyboard('mat')

        box = { top: -200, bottom: -160 }
        fireEvent.scroll(window)
        expect(suggestions()).toBeNull()

        box = { top: 300, bottom: 340 }
        fireEvent.scroll(window)
        expect(suggestions()).not.toBeNull()
      })

      it('opens above the box when there is no room below it', async () => {
        const user = await openPage()
        await startEditing(user)
        box = { top: window.innerHeight - 90, bottom: window.innerHeight - 50 }
        await user.keyboard('mat')

        expect(suggestions()).toHaveStyle({ bottom: '94px' })
      })
    })

    it('lets a tag after a comma be completed from the list, keeping the ones typed before it', async () => {
      const user = await openPage()
      await startEditing(user)

      await user.keyboard('Brand new, foil')
      await user.click(
        within(suggestions()!).getByRole('option', { name: 'Material_Foil' }),
      )

      expect(within(block()).getByText('Brand new')).toBeInTheDocument()
      expect(within(block()).getByText('Material_Foil')).toBeInTheDocument()
    })
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
