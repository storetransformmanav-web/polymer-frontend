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
  status: 'DRAFT',
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

const DETAIL = {
  shop: SHOP,
  id: 'id-1',
  shopify_id: 1,
  title: 'Sushi Tray',
  handle: 'sushi-tray',
  description_html: '',
  status: 'DRAFT',
  vendor: 'Polymer',
  product_type: 'Trays',
  category: null,
  tags: [],
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
  message: 'Saved. Sending to the store.',
}

const list = vi.mocked(api.products.list)
const details = vi.mocked(api.products.details)
const update = vi.mocked(api.products.update)
const syncHistory = vi.mocked(api.products.syncHistory)

// The list stays mounted behind the page (CSS hides it, jsdom has none), so look only in the header.
const header = () =>
  screen.getByRole('heading', { level: 1, name: 'Sushi Tray' }).closest('article')!
const statusButton = () =>
  within(header()).getByRole('button', { name: /^Status of Sushi Tray:/ })

describe('changing the status from the product page header', () => {
  beforeEach(() => {
    list.mockResolvedValue(LIST)
    details.mockResolvedValue(DETAIL)
    update.mockResolvedValue(WRITE_OK)
    syncHistory.mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  async function openPage() {
    const user = userEvent.setup()
    renderWithProviders(
      <Routes>
        <Route path="/products/*" element={<ProductsPage />} />
      </Routes>,
      { route: '/products/id-1' },
    )
    await screen.findByRole('heading', { level: 1, name: 'Sushi Tray' })
    await within(header()).findByRole('button', { name: /^Status of Sushi Tray:/ })
    return user
  }

  it('shows the status as a dropdown beside the vendor', async () => {
    await openPage()
    expect(statusButton()).toHaveTextContent('Draft')
    expect(statusButton()).toHaveAttribute('aria-haspopup', 'listbox')
  })

  it('asks first, then saves only the status', async () => {
    const user = await openPage()
    await user.click(statusButton())
    await user.click(screen.getByRole('option', { name: 'Active' }))

    // Nothing is sent until "Yes, update".
    expect(screen.getByText('Change “Sushi Tray” to Active?')).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()

    // The quiet re-read after the save now brings back the new status.
    details.mockResolvedValue({ ...DETAIL, status: 'ACTIVE' })
    await confirmUpdate(user)
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('id-1', { status: 'ACTIVE' }, 'polymer-uk'),
    )
    await waitFor(() => expect(statusButton()).toHaveTextContent('Active'))
  })

  it('sends nothing when the dialog is cancelled', async () => {
    const user = await openPage()
    await user.click(statusButton())
    await user.click(screen.getByRole('option', { name: 'Archived' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(update).not.toHaveBeenCalled()
    expect(statusButton()).toHaveTextContent('Draft')
  })

  it('goes back to the old status and shows the backend’s message when the save fails', async () => {
    update.mockRejectedValue(new ApiError('Shopify said no.', { status: 422 }))
    const user = await openPage()
    await user.click(statusButton())
    await user.click(screen.getByRole('option', { name: 'Active' }))
    await confirmUpdate(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('Shopify said no.')
    expect(statusButton()).toHaveTextContent('Draft')
  })
})
