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

function row(id: string, title: string): ProductListItem {
  return {
    shop: SHOP,
    id,
    shopify_id: Number(id.replace('id-', '')),
    title,
    handle: title.toLowerCase().replace(/ /g, '-'),
    status: 'ACTIVE',
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

const HIPPO = row('id-1', 'Hippo Bag')
const LID = row('id-2', 'Foil Lid')
const LIST: ProductListResponse = {
  items: [HIPPO, LID],
  page: 1,
  page_size: 25,
  total: 2,
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
  message: 'Product archived',
}

const list = vi.mocked(api.products.list)
const remove = vi.mocked(api.products.remove)
const never = () => new Promise<never>(() => undefined)

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/products/*" element={<ProductsPage />} />
    </Routes>,
    { route: '/products' },
  )
}

describe('deleting a product from the list', () => {
  beforeEach(() => {
    list.mockResolvedValue(LIST)
    remove.mockResolvedValue(WRITE_OK)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  async function askToDelete(title = 'Hippo Bag') {
    const user = userEvent.setup()
    renderPage()
    await screen.findByLabelText(`Select ${title}`)
    await user.click(screen.getByRole('button', { name: `Delete ${title}` }))
    const dialog = await screen.findByRole('alertdialog', { name: `Delete “${title}”?` })
    return { user, dialog }
  }

  it('gives every row two actions: View and Delete — there is no Edit pencil', async () => {
    renderPage()
    await screen.findByLabelText('Select Hippo Bag')

    for (const name of ['View Hippo Bag', 'Delete Hippo Bag']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    expect(
      screen.queryByRole('button', { name: 'Edit Hippo Bag' }),
    ).not.toBeInTheDocument()
  })

  it('asks first — one choice, Yes, delete; Cancel is focused — and sends nothing yet', async () => {
    const { dialog } = await askToDelete()

    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(
      within(dialog).getByRole('button', { name: 'Yes, delete' }),
    ).toBeInTheDocument()
    expect(within(dialog).getAllByRole('button')).toHaveLength(2)
    // No Archive option: delete is the only thing it does.
    expect(within(dialog).queryByRole('radio')).toBeNull()
    expect(within(dialog).queryByText(/Archive/)).toBeNull()
    expect(
      within(dialog).getByText('Are you sure you want to delete this product?'),
    ).toBeInTheDocument()
    expect(within(dialog).getByText(/also be deleted in Shopify/)).toBeInTheDocument()
    expect(remove).not.toHaveBeenCalled()
  })

  it('closes on Cancel and on Escape without deleting anything', async () => {
    const { user, dialog } = await askToDelete()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete Hippo Bag' }))
    await screen.findByRole('alertdialog')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    expect(remove).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Select Hippo Bag')).toBeInTheDocument()
  })

  it('deletes with mode=delete for that store, and the row is gone at once', async () => {
    remove.mockResolvedValue({ ...WRITE_OK, message: 'Product deleted' })
    const { user, dialog } = await askToDelete()
    // The refetch hasn't answered yet — what shows is the instant update.
    list.mockImplementation(never)
    await user.click(within(dialog).getByRole('button', { name: 'Yes, delete' }))

    await waitFor(() =>
      expect(remove).toHaveBeenCalledWith('id-1', 'polymer-uk', 'delete'),
    )
    expect(await screen.findByText('“Hippo Bag”: Product deleted')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Select Hippo Bag')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Select Foil Lid')).toBeInTheDocument()
  })

  it("keeps the dialog open and shows the backend's message when it fails", async () => {
    remove.mockRejectedValue(new ApiError('Product not found.', { status: 404 }))
    const { user, dialog } = await askToDelete()
    await user.click(within(dialog).getByRole('button', { name: 'Yes, delete' }))

    expect(await within(dialog).findByText('Product not found.')).toBeInTheDocument()
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Select Hippo Bag')).toBeInTheDocument()
    // Usable again for another try.
    expect(within(dialog).getByRole('button', { name: 'Yes, delete' })).toBeEnabled()
  })

  it('locks the dialog while the request is in flight, so it cannot be sent twice', async () => {
    remove.mockImplementation(never)
    const { user, dialog } = await askToDelete()
    await user.click(within(dialog).getByRole('button', { name: 'Yes, delete' }))

    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /Deleting/ })).toBeDisabled(),
    )
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()

    await user.keyboard('{Escape}')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(remove).toHaveBeenCalledTimes(1)
  })
})
