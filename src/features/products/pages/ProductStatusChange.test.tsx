import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api/ApiError.ts'
import {
  api,
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
      remove: vi.fn(),
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

function row(id: string, title: string, status: string): ProductListItem {
  return {
    shop: SHOP,
    id,
    shopify_id: Number(id.replace('id-', '')),
    title,
    handle: title.toLowerCase().replace(/ /g, '-'),
    status,
    vendor: 'Polymer',
    product_type: 'Bags',
    category_name: null,
    tags: [],
    image_url: null,
    price_min: '6.00',
    price_max: '7.50',
    currency: 'GBP',
    variants_count: 1,
    total_inventory: 5,
    shopify_created_at: null,
    shopify_updated_at: null,
    synced_at: '2026-01-01T00:00:00Z',
  }
}

const LIST: ProductListResponse = {
  items: [
    row('id-1', 'Hippo Bag', 'ACTIVE'),
    row('id-2', 'Foil Lid', 'DRAFT'),
    row('id-3', 'Odd Box', 'UNLISTED'),
  ],
  page: 1,
  page_size: 25,
  total: 3,
  total_pages: 1,
  has_next: false,
  sort: 'created_at',
  order: 'desc',
}

const writeOk = (id: string): ProductWriteResult => ({
  product_id: id,
  sync_status: 'pending',
  push_id: `push-${id}`,
  changes: null,
  message: 'Saved. Sending to the store.',
})

const list = vi.mocked(api.products.list)
const update = vi.mocked(api.products.update)
const syncHistory = vi.mocked(api.products.syncHistory)
const never = () => new Promise<never>(() => undefined)

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/products/*" element={<ProductsPage />} />
    </Routes>,
    { route: '/products' },
  )
}

const statusOf = (title: string) =>
  screen.getByRole('combobox', { name: `Status of ${title}` })

describe('changing a status from the products table', () => {
  beforeEach(() => {
    list.mockResolvedValue(LIST)
    update.mockImplementation(async (id) => writeOk(id))
    syncHistory.mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  async function openList() {
    const user = userEvent.setup()
    renderPage()
    await screen.findByLabelText('Select Hippo Bag')
    return user
  }

  it('shows every product’s status as a dropdown offering Active, Draft and Archived', async () => {
    await openList()

    expect(statusOf('Hippo Bag')).toHaveValue('ACTIVE')
    expect(statusOf('Foil Lid')).toHaveValue('DRAFT')
    const options = within(statusOf('Hippo Bag'))
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(options).toEqual(['Active', 'Draft', 'Archived'])
  })

  it('shows a status the API cannot set (Unlisted), but only as a place to move away from', async () => {
    await openList()

    expect(statusOf('Odd Box')).toHaveValue('UNLISTED')
    expect(
      within(statusOf('Odd Box')).getByRole('option', { name: 'Unlisted' }),
    ).toBeDisabled()
  })

  it('saves the chosen status at once, for the product’s store, and keeps it on screen', async () => {
    const user = await openList()
    // The refetch hasn't answered: what shows is the instant update.
    list.mockImplementation(never)
    await user.selectOptions(statusOf('Hippo Bag'), 'DRAFT')

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith('id-1', { status: 'DRAFT' }, 'polymer-uk'),
    )
    expect(statusOf('Hippo Bag')).toHaveValue('DRAFT')
    await waitFor(() => expect(statusOf('Hippo Bag')).toBeEnabled())
    // Nothing else was touched.
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('shows the new status straight away while the save is still running, and locks that row', async () => {
    update.mockImplementation(never)
    const user = await openList()
    await user.selectOptions(statusOf('Hippo Bag'), 'ARCHIVED')

    expect(statusOf('Hippo Bag')).toHaveValue('ARCHIVED')
    expect(statusOf('Hippo Bag')).toBeDisabled()
    // Other rows stay usable.
    expect(statusOf('Foil Lid')).toBeEnabled()
  })

  it('puts the old status back and shows the backend’s message when the save fails', async () => {
    update.mockRejectedValue(
      new ApiError('You cannot archive this product.', { status: 422 }),
    )
    const user = await openList()
    await user.selectOptions(statusOf('Hippo Bag'), 'ARCHIVED')

    expect(
      await screen.findByText('You cannot archive this product.'),
    ).toBeInTheDocument()
    expect(statusOf('Hippo Bag')).toHaveValue('ACTIVE')
    expect(statusOf('Hippo Bag')).toBeEnabled()
  })

  it('changes several products independently', async () => {
    const user = await openList()
    await user.selectOptions(statusOf('Hippo Bag'), 'ARCHIVED')
    await user.selectOptions(statusOf('Foil Lid'), 'ACTIVE')

    await waitFor(() => expect(update).toHaveBeenCalledTimes(2))
    expect(update).toHaveBeenCalledWith('id-1', { status: 'ARCHIVED' }, 'polymer-uk')
    expect(update).toHaveBeenCalledWith('id-2', { status: 'ACTIVE' }, 'polymer-uk')
  })
})
