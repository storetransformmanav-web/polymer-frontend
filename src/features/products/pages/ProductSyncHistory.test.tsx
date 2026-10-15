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
  type ProductPush,
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
  variants_count: 0,
  total_inventory: 5,
  shopify_created_at: null,
  shopify_updated_at: null,
  synced_at: '2026-01-01T00:00:00Z',
} satisfies ProductListItem

const DETAIL = {
  shop: SHOP,
  id: 'id-1',
  shopify_id: 1,
  title: 'Hippo Bag',
  handle: 'hippo-bag',
  description_html: '',
  status: 'ACTIVE',
  vendor: 'Polymer',
  product_type: 'Bags',
  category: null,
  tags: [],
  template_suffix: '',
  seo: { title: null, description: null },
  currency: 'GBP',
  price_range: { min: '25.85', max: '25.85', currency: 'GBP' },
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
  push_id: 'push-2',
  changes: null,
  message: 'Saved. Sending to the store.',
}

const PUSH_OK: ProductPush = {
  id: 'push-1',
  entity: 'product',
  entity_id: 'id-1',
  action: 'update',
  status: 'success',
  attempts: 1,
  error: null,
  changes: { title: 'x', vendor: 'y' },
  created_at: '2026-10-15T10:00:00Z',
  finished_at: '2026-10-15T10:00:03Z',
}

const PUSH_FAILED: ProductPush = {
  id: 'push-0',
  entity: 'product',
  entity_id: 'id-1',
  action: 'update',
  status: 'failed',
  attempts: 3,
  error: 'Shopify rejected the handle',
  changes: null,
  created_at: '2026-10-14T09:00:00Z',
  finished_at: '2026-10-14T09:00:09Z',
}

const list = vi.mocked(api.products.list)
const details = vi.mocked(api.products.details)
const update = vi.mocked(api.products.update)
const syncHistory = vi.mocked(api.products.syncHistory)
const never = () => new Promise<never>(() => undefined)

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/products/*" element={<ProductsPage />} />
    </Routes>,
    { route: '/products/id-1' },
  )
}

async function openDetails() {
  const user = userEvent.setup()
  renderPage()
  await screen.findByRole('heading', { level: 1, name: 'Hippo Bag' })
  return user
}

const section = () =>
  screen.getByRole('heading', { name: /Sync History/ }).closest('section') as HTMLElement
const findSection = async () =>
  (await screen.findByRole('heading', { name: /Sync History/ })).closest(
    'section',
  ) as HTMLElement

describe('the sync history below a product’s details', () => {
  beforeEach(() => {
    list.mockResolvedValue(LIST)
    details.mockResolvedValue(DETAIL)
    update.mockResolvedValue(WRITE_OK)
    syncHistory.mockResolvedValue([PUSH_OK, PUSH_FAILED])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('lists every push with its action, status, attempts, changes and error', async () => {
    await openDetails()
    const history = within(await findSection())

    const rows = await history.findAllByRole('row')
    // Header + two pushes, newest first.
    expect(rows).toHaveLength(3)
    expect(within(rows[1]).getByText('Update')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Synced')).toBeInTheDocument()
    expect(within(rows[1]).getByText('title, vendor')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Failed')).toBeInTheDocument()
    expect(within(rows[2]).getByText('3')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Shopify rejected the handle')).toBeInTheDocument()
    expect(syncHistory).toHaveBeenCalledWith('id-1', 'polymer-uk', 20)
  })

  it('says so when nothing has been synced yet', async () => {
    syncHistory.mockResolvedValue([])
    await openDetails()

    expect(await screen.findByText('No syncs yet')).toBeInTheDocument()
  })

  it('shows a placeholder while the first answer loads, not a blank gap', async () => {
    syncHistory.mockImplementation(never)
    await openDetails()

    expect(
      await screen.findByRole('status', { name: 'Loading sync history' }),
    ).toBeInTheDocument()
  })

  it('has a Sync button at the top that asks the sync API again and shows the answer at once', async () => {
    const user = await openDetails()
    await waitFor(() => expect(syncHistory).toHaveBeenCalledTimes(1))
    await within(await findSection()).findAllByRole('row')

    syncHistory.mockResolvedValue([
      {
        ...PUSH_OK,
        id: 'push-9',
        action: 'delete',
        status: 'pending',
        finished_at: null,
      },
      PUSH_OK,
      PUSH_FAILED,
    ])
    await user.click(screen.getByRole('button', { name: 'Sync product' }))

    await waitFor(() => expect(syncHistory).toHaveBeenCalledTimes(2))
    expect(await within(section()).findByText('Delete')).toBeInTheDocument()
    expect(within(section()).getByText('In progress')).toBeInTheDocument()
  })

  it('locks the Sync button while the request is running, so it is not sent twice', async () => {
    const user = await openDetails()
    await within(await findSection()).findAllByRole('row')

    syncHistory.mockImplementation(never)
    await user.click(screen.getByRole('button', { name: 'Sync product' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sync product' })).toBeDisabled(),
    )
    expect(syncHistory).toHaveBeenCalledTimes(2)
  })

  it('shows the backend’s message with a Try again when the history cannot be loaded', async () => {
    syncHistory.mockRejectedValue(
      new ApiError('Sync history is unavailable.', { status: 500 }),
    )
    const user = await openDetails()

    expect(await screen.findByText('Sync history is unavailable.')).toBeInTheDocument()

    syncHistory.mockResolvedValue([PUSH_OK])
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await within(section()).findByText('Synced')).toBeInTheDocument()
  })

  it('refreshes itself after a section is saved, so the new push appears without a reload', async () => {
    const user = await openDetails()
    await within(await findSection()).findAllByRole('row')

    syncHistory.mockResolvedValue([
      {
        ...PUSH_OK,
        id: 'push-new',
        status: 'pending',
        finished_at: null,
        changes: { vendor: 'z' },
      },
      PUSH_OK,
    ])
    await user.click(screen.getByRole('button', { name: 'Edit specifications' }))
    await user.type(screen.getByLabelText('Vendor'), ' Ltd')
    await user.click(screen.getByRole('button', { name: 'Save specifications' }))

    await waitFor(() => expect(update).toHaveBeenCalled())
    expect(await within(section()).findByText('In progress')).toBeInTheDocument()
  })

  it('does not show a phantom sync for a product it cannot place yet', async () => {
    details.mockImplementation(never)
    list.mockImplementation(never)
    renderPage()

    expect(await screen.findByRole('button', { name: 'Sync product' })).toBeDisabled()
    expect(syncHistory).not.toHaveBeenCalled()
  })
})
