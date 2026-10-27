import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api/ApiError.ts'
import {
  api,
  type ProductListItem,
  type ProductListParams,
  type ProductListResponse,
} from '../../../lib/api/endpoints.ts'
import { downloadBlob } from '../../../lib/download.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { ProductsPage } from './ProductsPage.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    products: { list: vi.fn(), details: vi.fn(), export: vi.fn() },
    auth: {},
  },
}))
vi.mock('../../../lib/download.ts', () => ({ downloadBlob: vi.fn() }))

const TOTAL = 250
/** The fake server has fewer archived products than the rest. */
const ARCHIVED_TOTAL = 40
const SHOP = {
  key: 'polymer-uk',
  name: 'Polymer UK',
  domain: 'polymer-uk-ltd.myshopify.com',
  currency: 'GBP',
}

function makeRow(n: number): ProductListItem {
  return {
    shop: SHOP,
    id: `id-${n}`,
    shopify_id: 1000 + n,
    title: `Product ${n}`,
    handle: `product-${n}`,
    status: n % 2 === 0 ? 'ACTIVE' : 'DRAFT',
    vendor: 'Polymer',
    product_type: 'Bags',
    category_name: null,
    tags: [],
    image_url: null,
    price_min: '10.00',
    price_max: '10.00',
    currency: 'GBP',
    variants_count: 1,
    total_inventory: n,
    shopify_created_at: null,
    shopify_updated_at: null,
    synced_at: '2026-01-01T00:00:00Z',
  }
}

/** A fake server with 250 products (40 when archived), paged by page/page_size. */
function respond(params: ProductListParams): ProductListResponse {
  const total = params.status === 'ARCHIVED' ? ARCHIVED_TOTAL : TOTAL
  const page = params.page ?? 1
  const pageSize = params.page_size ?? 25
  const start = (page - 1) * pageSize
  const count = Math.max(0, Math.min(pageSize, total - start))
  return {
    items: Array.from({ length: count }, (_, i) => makeRow(start + i + 1)),
    page,
    page_size: pageSize,
    total,
    total_pages: Math.ceil(total / pageSize),
    has_next: start + count < total,
    sort: params.sort ?? 'created_at',
    order: params.order ?? 'desc',
  }
}

const list = vi.mocked(api.products.list)
const exportProducts = vi.mocked(api.products.export)
const download = vi.mocked(downloadBlob)

const CSV = 'Handle,Title\nproduct-1,Café Mop\n'
const BOM = [0xef, 0xbb, 0xbf]

function renderPage() {
  renderWithProviders(
    <Routes>
      <Route path="/products/*" element={<ProductsPage />} />
    </Routes>,
    { route: '/products' },
  )
}

async function openDialog() {
  const user = userEvent.setup()
  renderPage()
  await screen.findByText('Product 1')
  await user.click(screen.getByRole('button', { name: 'Export' }))
  const dialog = await screen.findByRole('dialog', { name: 'Export products' })
  return { user, dialog }
}

const exportButton = (dialog: HTMLElement) =>
  within(dialog).getByRole('button', { name: 'Export products' })

/** The Shopify ids of the list's first page: 1001 … 1025. */
const PAGE_IDS = Array.from({ length: 25 }, (_, i) => 1001 + i).join(',')

describe('exporting products', () => {
  beforeEach(() => {
    list.mockImplementation((params) => Promise.resolve(respond(params)))
    exportProducts.mockResolvedValue(CSV)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('the dialog', () => {
    it('opens from the Export button with the rows to export and the kind of file', async () => {
      const { dialog } = await openDialog()

      expect(within(dialog).getByRole('radio', { name: 'Current page' })).toBeChecked()
      expect(within(dialog).getByRole('radio', { name: /All products/ })).toBeEnabled()
      expect(
        within(dialog).getByRole('radio', { name: 'Selected: 0 products' }),
      ).toBeDisabled()
      expect(
        within(dialog).getByRole('radio', { name: /matching your search/ }),
      ).toBeDisabled()
      expect(
        within(dialog).getByRole('radio', { name: /CSV for Excel, Numbers/ }),
      ).toBeChecked()
      expect(within(dialog).getByRole('radio', { name: 'Plain CSV file' })).toBeEnabled()
      expect(
        within(dialog).getByRole('checkbox', { name: /Include metafields/ }),
      ).toBeChecked()
      // Opening it asks the API for nothing.
      expect(exportProducts).not.toHaveBeenCalled()
    })

    it('closes with Cancel, the ✕ or Escape, and exports nothing', async () => {
      const { user } = await openDialog()
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('dialog', { name: 'Export products' })).toBeNull()

      await user.click(screen.getByRole('button', { name: 'Export' }))
      await user.click(
        within(screen.getByRole('dialog', { name: 'Export products' })).getByRole(
          'button',
          {
            name: 'Close',
          },
        ),
      )
      expect(screen.queryByRole('dialog', { name: 'Export products' })).toBeNull()

      await user.click(screen.getByRole('button', { name: 'Export' }))
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('dialog', { name: 'Export products' })).toBeNull()

      expect(exportProducts).not.toHaveBeenCalled()
      expect(download).not.toHaveBeenCalled()
    })
  })

  describe('exporting', () => {
    it('sends the page’s Shopify ids to GET /products/export and saves the file for Excel', async () => {
      const { user, dialog } = await openDialog()

      await user.click(exportButton(dialog))

      await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
      expect(exportProducts).toHaveBeenCalledTimes(1)
      expect(exportProducts.mock.calls[0][0]).toEqual({
        ids: PAGE_IDS,
        metafields: true,
      })

      const [filename, blob] = download.mock.calls[0]
      expect(filename).toMatch(/^products_export_all-stores_\d{8}-\d{4}\.csv$/)
      expect(blob.type).toBe('text/csv;charset=utf-8')
      // The API's text, with a byte-order mark in front so Excel reads accents.
      const bytes = new Uint8Array(await blob.arrayBuffer())
      expect([...bytes.slice(0, 3)]).toEqual(BOM)
      expect(new TextDecoder().decode(bytes.slice(3))).toBe(CSV)

      expect(
        await screen.findByText(`Exported 25 products to ${filename}`),
      ).toBeInTheDocument()
      expect(screen.queryByRole('dialog', { name: 'Export products' })).toBeNull()
    })

    it('saves a plain CSV exactly as sent, without metafields when unticked', async () => {
      const { user, dialog } = await openDialog()

      await user.click(within(dialog).getByRole('radio', { name: 'Plain CSV file' }))
      await user.click(
        within(dialog).getByRole('checkbox', { name: /Include metafields/ }),
      )
      await user.click(exportButton(dialog))

      await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
      expect(exportProducts.mock.calls[0][0]).toEqual({
        ids: PAGE_IDS,
        metafields: false,
      })
      const bytes = new Uint8Array(await download.mock.calls[0][1].arrayBuffer())
      expect([...bytes.slice(0, 3)]).not.toEqual(BOM)
      expect(new TextDecoder().decode(bytes)).toBe(CSV)
    })

    it('exports every product with only the metafields option', async () => {
      const { user, dialog } = await openDialog()

      await user.click(within(dialog).getByRole('radio', { name: /All products/ }))
      await user.click(exportButton(dialog))

      await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
      expect(exportProducts.mock.calls[0][0]).toEqual({ metafields: true })
      expect(
        await screen.findByText(/^Exported all products to products_export_/),
      ).toBeInTheDocument()
    })

    it('exports the ticked products, which the dialog starts on', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Product 1')
      await user.click(screen.getByRole('checkbox', { name: 'Select Product 2' }))
      await user.click(screen.getByRole('checkbox', { name: 'Select Product 4' }))

      await user.click(screen.getByRole('button', { name: 'Export' }))
      const dialog = await screen.findByRole('dialog', { name: 'Export products' })
      expect(
        within(dialog).getByRole('radio', { name: 'Selected: 2 products' }),
      ).toBeChecked()
      await user.click(exportButton(dialog))

      await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
      expect(exportProducts.mock.calls[0][0]).toEqual({
        ids: '1002,1004',
        metafields: true,
      })
    })

    it('exports what the list is narrowed to: the same search and status', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Product 1')
      await user.type(screen.getByRole('searchbox', { name: 'Search products' }), 'desk')
      await user.click(screen.getByRole('button', { name: 'Filters' }))
      await user.selectOptions(screen.getByLabelText('Product status'), 'ARCHIVED')
      await waitFor(() =>
        expect(list).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'desk', status: 'ARCHIVED' }),
        ),
      )

      await user.click(screen.getByRole('button', { name: 'Export' }))
      const dialog = await screen.findByRole('dialog', { name: 'Export products' })
      await user.click(
        await within(dialog).findByRole('radio', {
          name: '40 products matching your search',
        }),
      )
      await user.click(exportButton(dialog))

      await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
      expect(exportProducts.mock.calls[0][0]).toEqual({
        metafields: true,
        search: 'desk',
        status: 'archived',
      })
      expect(
        await screen.findByText(/^Exported 40 products to products_export_/),
      ).toBeInTheDocument()
    })
  })

  describe('while the file is being made', () => {
    it('shows progress, and Cancel stops it without downloading anything', async () => {
      let signal: AbortSignal | undefined
      // The backend is still building the file.
      exportProducts.mockImplementation((_params, abort) => {
        signal = abort
        return new Promise<never>(() => undefined)
      })
      const { user, dialog } = await openDialog()
      await user.click(exportButton(dialog))

      expect(await screen.findByText(/Exporting…/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled()

      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(signal?.aborted).toBe(true)
      expect(screen.queryByText(/Exporting…/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled()
      expect(download).not.toHaveBeenCalled()
    })

    it('shows the backend’s message and downloads nothing when the export fails', async () => {
      exportProducts.mockRejectedValue(
        new ApiError('The server is busy. Try again.', { status: 503 }),
      )
      const { user, dialog } = await openDialog()

      await user.click(exportButton(dialog))

      expect(
        await screen.findByText('The server is busy. Try again.'),
      ).toBeInTheDocument()
      expect(download).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled()
      await user.click(screen.getByRole('button', { name: 'Dismiss' }))
      expect(screen.queryByText('The server is busy. Try again.')).not.toBeInTheDocument()
    })
  })

  it('is off when there is nothing to export', async () => {
    list.mockImplementation((params) =>
      Promise.resolve({ ...respond(params), items: [], total: 0, total_pages: 1 }),
    )
    renderPage()

    expect(await screen.findByText(/No products found/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled()
  })
})
