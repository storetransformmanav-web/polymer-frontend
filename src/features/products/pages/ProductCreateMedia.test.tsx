import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  api,
  type ProductCreateResult,
  type ProductDetail,
  type ProductListItem,
  type ProductListResponse,
  type ProductWriteResult,
  type Shop,
} from '../../../lib/api/endpoints.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { ProductsPage } from './ProductsPage.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    shops: { list: vi.fn() },
    inventory: { locations: vi.fn() },
    products: {
      list: vi.fn(),
      details: vi.fn(),
      create: vi.fn(),
      addMedia: vi.fn(),
      syncHistory: vi.fn(),
    },
    auth: {},
  },
}))

// These tests type into a long form and advance fake timers: allow for a slow machine.
vi.setConfig({ testTimeout: 20_000 })

const SHOP: Shop = {
  id: 's1',
  key: 'polymer-uk',
  name: 'Polymer UK',
  domain: 'uk.myshopify.com',
  currency: 'GBP',
  is_active: true,
  position: 0,
  connected: true,
  products_count: 0,
}

const ROW_SHOP = {
  key: 'polymer-uk',
  name: 'Polymer UK',
  domain: 'uk.myshopify.com',
  currency: 'GBP',
}

function row(id: string, title: string): ProductListItem {
  return {
    shop: ROW_SHOP,
    id,
    shopify_id: 1,
    title,
    handle: title.toLowerCase().replace(/ /g, '-'),
    status: 'DRAFT',
    vendor: null,
    product_type: null,
    category_name: null,
    tags: [],
    image_url: null,
    price_min: '9.99',
    price_max: '9.99',
    currency: 'GBP',
    variants_count: 1,
    total_inventory: null,
    shopify_created_at: null,
    shopify_updated_at: null,
    synced_at: '2026-01-01T00:00:00Z',
  }
}

const EXISTING = row('id-1', 'Hippo Bag')

const page = (items: ProductListItem[]): ProductListResponse => ({
  items,
  page: 1,
  page_size: 25,
  total: items.length,
  total_pages: 1,
  has_next: false,
  sort: 'created_at',
  order: 'desc',
})

const CREATED: ProductCreateResult = {
  product_id: 'new-id',
  shopify_id: 999,
  shopify_gid: 'gid://shopify/Product/999',
  handle: 'sushi-tray',
  title: 'Sushi Tray',
  status: 'DRAFT',
  shop: 'polymer-uk',
  variants: 1,
  media: 2,
  message: 'Product created in Shopify and saved',
}

const WRITE_OK: ProductWriteResult = {
  product_id: 'new-id',
  sync_status: 'pending',
  push_id: 'push-1',
  changes: null,
  message: 'Media queued for Shopify',
}

const A = 'https://cdn.example.com/a.jpg'
const B = 'https://cdn.example.com/b.jpg'
const C = 'https://cdn.example.com/c.jpg'

/** The new product as the CRM returns it, with the images it knows about so far. */
function detail(images: { id: string; url: string }[]): ProductDetail {
  return {
    shop: ROW_SHOP,
    id: 'new-id',
    shopify_id: 999,
    title: 'Sushi Tray',
    handle: 'sushi-tray',
    description_html: '',
    status: 'DRAFT',
    vendor: null,
    product_type: null,
    category: null,
    tags: [],
    template_suffix: '',
    seo: { title: null, description: null },
    currency: 'GBP',
    price_range: { min: '9.99', max: '9.99', currency: 'GBP' },
    compare_at_price_range: null,
    featured_image_url: images[0]?.url ?? null,
    total_inventory: 0,
    variants_count: 1,
    options: [],
    images: images.map((image, i) => ({
      id: image.id,
      url: image.url,
      alt_text: null,
      position: i + 1,
      media_type: 'IMAGE',
    })),
    variants: [],
    collections: [],
    metafields: [],
  } as unknown as ProductDetail
}

const list = vi.mocked(api.products.list)
const details = vi.mocked(api.products.details)
const create = vi.mocked(api.products.create)
const addMedia = vi.mocked(api.products.addMedia)

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/products/*" element={<ProductsPage />} />
    </Routes>,
    { route: '/products' },
  )
}

describe('images added when a product is created, and added later from the Media tab', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    list.mockResolvedValue(page([EXISTING]))
    vi.mocked(api.shops.list).mockResolvedValue([SHOP])
    vi.mocked(api.inventory.locations).mockResolvedValue([])
    vi.mocked(api.products.syncHistory).mockResolvedValue([])
    create.mockResolvedValue(CREATED)
    addMedia.mockResolvedValue(WRITE_OK)
    // The store hasn't downloaded anything yet.
    details.mockResolvedValue(detail([]))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  /** Creates "Sushi Tray" with two images, then opens its Media tab. */
  async function createAndOpenMedia() {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage()
    await screen.findByLabelText('Select Hippo Bag')
    await user.click(screen.getByRole('button', { name: 'Add product' }))
    const form = await screen.findByRole('region', { name: 'Add product' })
    await user.type(within(form).getByLabelText('Title'), 'Sushi Tray')
    await user.type(within(form).getByLabelText('Price'), '9.99')
    await user.type(within(form).getByLabelText('Web address'), A)
    await user.click(within(form).getByRole('button', { name: 'Add another file' }))
    await user.type(within(form).getAllByLabelText('Web address')[1], B)
    await user.click(within(form).getAllByRole('button', { name: 'Create product' })[0])
    await screen.findByText(/Created “Sushi Tray”/)

    await user.click(screen.getByRole('button', { name: 'View Sushi Tray' }))
    await user.click(await screen.findByRole('tab', { name: /^Media/ }))
    return user
  }

  it('shows the images it was created with as processing on the details page, not "No images"', async () => {
    await createAndOpenMedia()

    expect(await screen.findAllByLabelText('Processing')).toHaveLength(2)
    expect(screen.getByText('2 processing')).toBeInTheDocument()
    expect(screen.queryByText('No images')).not.toBeInTheDocument()
  })

  it('adds a new image alongside them — nothing is replaced or hidden', async () => {
    const user = await createAndOpenMedia()
    expect(await screen.findAllByLabelText('Processing')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Add media' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add media' })
    await user.type(within(dialog).getByLabelText('Web address'), C)
    await user.click(within(dialog).getByRole('button', { name: 'Add to product' }))

    await waitFor(() => expect(addMedia).toHaveBeenCalled())
    expect(addMedia.mock.calls[0][1]).toEqual([{ url: C, media_type: 'IMAGE' }])
    await waitFor(() => expect(screen.getAllByLabelText('Processing')).toHaveLength(3))
    expect(screen.getByText('3 processing')).toBeInTheDocument()
  })

  it('swaps each waiting file for its real image as the store finishes, keeping the others', async () => {
    const user = await createAndOpenMedia()
    await screen.findAllByLabelText('Processing')
    await user.click(screen.getByRole('button', { name: 'Add media' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add media' })
    await user.type(within(dialog).getByLabelText('Web address'), C)
    await user.click(within(dialog).getByRole('button', { name: 'Add to product' }))
    await waitFor(() => expect(screen.getAllByLabelText('Processing')).toHaveLength(3))

    // One file is downloaded: it is now a real image, the other two still wait.
    details.mockResolvedValue(
      detail([{ id: 'img-a', url: 'https://cdn.shopify.com/a.jpg' }]),
    )
    await act(() => vi.advanceTimersByTimeAsync(4100))
    await waitFor(() => expect(screen.getAllByLabelText('Processing')).toHaveLength(2))
    expect(screen.getByText('1 image · 2 processing')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete image 1' })).toBeInTheDocument()

    // Then the rest arrive: nothing is left waiting, all three are real images.
    details.mockResolvedValue(
      detail([
        { id: 'img-a', url: 'https://cdn.shopify.com/a.jpg' },
        { id: 'img-b', url: 'https://cdn.shopify.com/b.jpg' },
        { id: 'img-c', url: 'https://cdn.shopify.com/c.jpg' },
      ]),
    )
    await act(() => vi.advanceTimersByTimeAsync(4100))
    await waitFor(() =>
      expect(screen.queryByLabelText('Processing')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('3 images')).toBeInTheDocument()
  })

  it('keeps the created images listed when the store is slow, instead of dropping them', async () => {
    await createAndOpenMedia()
    await screen.findAllByLabelText('Processing')

    await act(() => vi.advanceTimersByTimeAsync(65_000))

    expect(screen.getAllByLabelText('Processing')).toHaveLength(2)
    expect(screen.getByText(/taking longer than usual/)).toBeInTheDocument()
  })
})
