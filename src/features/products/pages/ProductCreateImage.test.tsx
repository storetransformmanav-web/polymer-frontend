import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    products: { list: vi.fn(), details: vi.fn(), create: vi.fn(), syncHistory: vi.fn() },
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

function row(id: string, title: string, imageUrl: string | null = null): ProductListItem {
  return {
    shop: {
      key: 'polymer-uk',
      name: 'Polymer UK',
      domain: 'uk.myshopify.com',
      currency: 'GBP',
    },
    id,
    shopify_id: 1,
    title,
    handle: title.toLowerCase().replace(/ /g, '-'),
    status: 'DRAFT',
    vendor: null,
    product_type: null,
    category_name: null,
    tags: [],
    image_url: imageUrl,
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
  media: 1,
  message: 'Product created in Shopify and saved',
}

const USER_URL = 'https://cdn.example.com/tray.jpg'
const STORE_URL = 'https://cdn.shopify.com/s/files/1/0001/tray.jpg'

const list = vi.mocked(api.products.list)
const create = vi.mocked(api.products.create)

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/products/*" element={<ProductsPage />} />
    </Routes>,
    { route: '/products' },
  )
}

describe('a product created with an image', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    list.mockResolvedValue(page([EXISTING]))
    vi.mocked(api.shops.list).mockResolvedValue([SHOP])
    vi.mocked(api.inventory.locations).mockResolvedValue([])
    vi.mocked(api.products.syncHistory).mockResolvedValue([])
    create.mockResolvedValue(CREATED)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  async function openForm() {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPage()
    await screen.findByLabelText('Select Hippo Bag')
    await user.click(screen.getByRole('button', { name: 'Add product' }))
    const form = await screen.findByRole('region', { name: 'Add product' })
    await user.type(within(form).getByLabelText('Title'), 'Sushi Tray')
    await user.type(within(form).getByLabelText('Price'), '9.99')
    return { user, form }
  }

  /**
   * Gives the new product a picture by its address. The single product has no "Image link" box
   * (its pictures are uploaded); an address is entered in a variant's own column, so this adds
   * one option value — a product with a single "Small" variant — and types it there.
   */
  async function addImageLink(
    user: ReturnType<typeof userEvent.setup>,
    form: HTMLElement,
    url: string,
  ) {
    await user.click(
      within(form).getByRole('button', { name: 'Add options like size or colour' }),
    )
    await user.type(within(form).getByLabelText('Option name'), 'Size')
    await user.type(
      within(form).getByLabelText('Add values for option 1'),
      'Small{Enter}',
    )
    await user.type(within(form).getByLabelText('Image link for Small'), url)
  }

  const createButton = (form: HTMLElement) =>
    within(form).getAllByRole('button', { name: 'Create product' })[0]

  const newRowImage = () =>
    screen.getAllByRole('row')[1].querySelector('img') as HTMLImageElement | null

  it('keeps showing the address it was created with while the store downloads it, and waits for the store’s copy', async () => {
    const { user, form } = await openForm()
    await addImageLink(user, form, USER_URL)
    list.mockClear()
    await user.click(createButton(form))

    expect(await screen.findByText(/Created “Sushi Tray”/)).toBeInTheDocument()
    expect(
      screen.getByText(/Its image is being downloaded by the store/),
    ).toBeInTheDocument()
    expect(list).not.toHaveBeenCalled()
    expect(newRowImage()).toHaveAttribute('src', USER_URL)

    list.mockResolvedValue(page([row('new-id', 'Sushi Tray', STORE_URL), EXISTING]))
    await act(() => vi.advanceTimersByTimeAsync(4100))
    await waitFor(() => expect(newRowImage()).toHaveAttribute('src', STORE_URL))
  })

  it('looks again every few seconds and swaps in the store’s own image once it exists, then stops', async () => {
    const { user, form } = await openForm()
    await addImageLink(user, form, USER_URL)
    await user.click(createButton(form))
    await screen.findByText(/Created “Sushi Tray”/)

    // The store has downloaded it by now.
    list.mockResolvedValue(page([row('new-id', 'Sushi Tray', STORE_URL), EXISTING]))
    await act(() => vi.advanceTimersByTimeAsync(4100))
    await waitFor(() => expect(newRowImage()).toHaveAttribute('src', STORE_URL))

    list.mockClear()
    await act(() => vi.advanceTimersByTimeAsync(20_000))
    expect(list).not.toHaveBeenCalled()
  })

  it('keeps the picture on the new row when the list is re-read without an image yet', async () => {
    const { user, form } = await openForm()
    await addImageLink(user, form, USER_URL)
    await user.click(createButton(form))
    await screen.findByText(/Created “Sushi Tray”/)

    // The backend's row has no image: the picture must not vanish.
    list.mockResolvedValue(page([row('new-id', 'Sushi Tray'), EXISTING]))
    list.mockClear()
    await act(() => vi.advanceTimersByTimeAsync(9000))
    await waitFor(() => expect(list).toHaveBeenCalled())

    expect(newRowImage()).toHaveAttribute('src', USER_URL)
  })

  it('keeps the picture and keeps looking, more slowly, after the first 40 seconds', async () => {
    const { user, form } = await openForm()
    await addImageLink(user, form, USER_URL)
    await user.click(createButton(form))
    await screen.findByText(/Created “Sushi Tray”/)

    list.mockResolvedValue(page([row('new-id', 'Sushi Tray'), EXISTING]))
    await act(() => vi.advanceTimersByTimeAsync(45_000))
    expect(await screen.findByText(/its image hasn't arrived yet/)).toBeInTheDocument()
    expect(newRowImage()).toHaveAttribute('src', USER_URL)

    // Still looking (every 16 s), and the store's image replaces it when it arrives.
    list.mockResolvedValue(page([row('new-id', 'Sushi Tray', STORE_URL), EXISTING]))
    await act(() => vi.advanceTimersByTimeAsync(17_000))
    await waitFor(() => expect(newRowImage()).toHaveAttribute('src', STORE_URL))
  })

  it('keeps looking while the image has not arrived', async () => {
    const { user, form } = await openForm()
    await addImageLink(user, form, USER_URL)
    await user.click(createButton(form))
    await screen.findByText(/Created “Sushi Tray”/)

    list.mockResolvedValue(page([row('new-id', 'Sushi Tray'), EXISTING]))
    list.mockClear()
    await act(() => vi.advanceTimersByTimeAsync(12_500))

    expect(list.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('says so when the image never arrives, and what to check', async () => {
    const { user, form } = await openForm()
    await addImageLink(user, form, USER_URL)
    await user.click(createButton(form))
    await screen.findByText(/Created “Sushi Tray”/)

    list.mockResolvedValue(page([row('new-id', 'Sushi Tray'), EXISTING]))
    await act(() => vi.advanceTimersByTimeAsync(41_000))

    expect(await screen.findByText(/its image hasn't arrived yet/)).toBeInTheDocument()
    expect(screen.getByText(/direct, public link to an image file/)).toBeInTheDocument()
    expect(screen.getByText(/Media tab/)).toBeInTheDocument()
  })

  it('does not keep re-reading the list for a product created without an image', async () => {
    const { user, form } = await openForm()
    list.mockClear()
    await user.click(createButton(form))
    await screen.findByText(/Created “Sushi Tray”/)
    expect(screen.queryByText(/image is being downloaded/)).not.toBeInTheDocument()

    // One read right away (as before) and then quiet.
    await waitFor(() => expect(list).toHaveBeenCalled())
    list.mockClear()
    await act(() => vi.advanceTimersByTimeAsync(15_000))
    expect(list).not.toHaveBeenCalled()
  })
})
