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
  api: { products: { list: vi.fn(), details: vi.fn() }, auth: {} },
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
const download = vi.mocked(downloadBlob)

/** Requests the export made: whole pages of 100, not the list's own 25. */
const exportCalls = () => list.mock.calls.filter(([params]) => params.page_size === 100)

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

/** The file the last export handed to the browser: its name and text. */
async function lastDownload() {
  const [filename, blob] = download.mock.calls.at(-1)!
  return { filename, blob, text: await blob.text() }
}
const rows = (csv: string) => csv.split('\r\n').filter((line) => line !== '')

const exportButton = (dialog: HTMLElement) =>
  within(dialog).getByRole('button', { name: 'Export' })

describe('exporting products', () => {
  beforeEach(() => {
    list.mockImplementation((params) => Promise.resolve(respond(params)))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('the dialog', () => {
    it('opens from the Export button with the format, every column, the rows and advanced filters', async () => {
      const { dialog } = await openDialog()

      // Excel is the default format; CSV is the other. No PDF, no date range.
      expect(within(dialog).getByRole('radio', { name: 'Excel (.xlsx)' })).toBeChecked()
      expect(within(dialog).getByRole('radio', { name: 'CSV (.csv)' })).not.toBeChecked()
      expect(within(dialog).queryByText(/pdf/i)).not.toBeInTheDocument()
      expect(within(dialog).queryByText(/date range/i)).not.toBeInTheDocument()

      // Every column of the list is offered, all ticked to begin with.
      expect(within(dialog).getByText('22 selected')).toBeInTheDocument()
      for (const name of [
        'Product ID',
        'Title',
        'Status',
        'Vendor',
        'Price from',
        'Last synced',
      ]) {
        expect(within(dialog).getByRole('checkbox', { name })).toBeChecked()
      }

      // Rows: this page by default.
      expect(within(dialog).getByRole('checkbox', { name: /Current page/ })).toBeChecked()
      expect(
        within(dialog).getByRole('checkbox', { name: /Export all/ }),
      ).not.toBeChecked()
      // The advanced filters are an accordion, closed to begin with.
      expect(
        within(dialog).getByRole('button', { name: /Advanced filters/ }),
      ).toHaveAttribute('aria-expanded', 'false')
      expect(within(dialog).getByText('25 products')).toBeInTheDocument()
    })

    it('closes with Cancel, the ✕ or Escape, and exports nothing', async () => {
      const { user, dialog } = await openDialog()
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Export' }))
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', { name: 'Close' }),
      )
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Export' }))
      await screen.findByRole('dialog')
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(download).not.toHaveBeenCalled()
    })

    it('picks one format at a time', async () => {
      const { user, dialog } = await openDialog()

      await user.click(within(dialog).getByRole('radio', { name: 'CSV (.csv)' }))

      expect(within(dialog).getByRole('radio', { name: 'CSV (.csv)' })).toBeChecked()
      expect(
        within(dialog).getByRole('radio', { name: 'Excel (.xlsx)' }),
      ).not.toBeChecked()
    })

    it('selects all or none of the columns, and resets to the default — with no search box in it', async () => {
      const { user, dialog } = await openDialog()
      expect(within(dialog).queryByRole('searchbox')).not.toBeInTheDocument()

      await user.click(within(dialog).getByRole('button', { name: 'Clear' }))
      expect(within(dialog).getByText('0 selected')).toBeInTheDocument()
      expect(exportButton(dialog)).toBeDisabled()

      await user.click(within(dialog).getByRole('checkbox', { name: 'Title' }))
      await user.click(within(dialog).getByRole('checkbox', { name: 'Vendor' }))
      expect(within(dialog).getByText('2 selected')).toBeInTheDocument()
      expect(exportButton(dialog)).toBeEnabled()

      await user.click(within(dialog).getByRole('radio', { name: 'CSV (.csv)' }))
      await user.click(within(dialog).getByRole('button', { name: 'Reset to default' }))
      expect(within(dialog).getByText('22 selected')).toBeInTheDocument()
      expect(within(dialog).getByRole('radio', { name: 'Excel (.xlsx)' })).toBeChecked()

      await user.click(within(dialog).getByRole('button', { name: 'Clear' }))
      await user.click(within(dialog).getByRole('button', { name: 'Select all' }))
      expect(within(dialog).getByText('22 selected')).toBeInTheDocument()
    })

    it('keeps to one choice of rows, and cannot export with none', async () => {
      const { user, dialog } = await openDialog()
      const current = within(dialog).getByRole('checkbox', { name: /Current page/ })
      const all = within(dialog).getByRole('checkbox', { name: /Export all/ })

      await user.click(all)
      expect(all).toBeChecked()
      expect(current).not.toBeChecked()
      expect(within(dialog).getByText('250 products')).toBeInTheDocument()

      await user.click(all)
      expect(all).not.toBeChecked()
      expect(exportButton(dialog)).toBeDisabled()
    })
  })

  describe('exporting the current page', () => {
    it('downloads an Excel file at once, with nothing requested', async () => {
      const { user, dialog } = await openDialog()
      list.mockClear()
      await user.click(exportButton(dialog))

      expect(list).not.toHaveBeenCalled()
      expect(download).toHaveBeenCalledTimes(1)
      const { filename, blob } = await lastDownload()
      expect(filename).toMatch(/^products-page-1-\d{4}-\d{2}-\d{2}\.xlsx$/)
      expect(blob.type).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      // A ZIP archive ("PK").
      const bytes = new Uint8Array(await blob.arrayBuffer())
      expect([...bytes.slice(0, 2)]).toEqual([0x50, 0x4b])
      expect(
        await screen.findByText(/Exported 25 products to products-page-1-.*\.xlsx/),
      ).toBeVisible()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('downloads a CSV of only the chosen columns', async () => {
      const { user, dialog } = await openDialog()
      await user.click(within(dialog).getByRole('radio', { name: 'CSV (.csv)' }))
      await user.click(within(dialog).getByRole('button', { name: 'Clear' }))
      for (const name of ['Title', 'Status', 'Price from']) {
        await user.click(within(dialog).getByRole('checkbox', { name }))
      }
      await user.click(exportButton(dialog))

      const { filename, text } = await lastDownload()
      expect(filename).toMatch(/^products-page-1-\d{4}-\d{2}-\d{2}\.csv$/)
      const lines = rows(text.replace(/^﻿/, ''))
      expect(lines).toHaveLength(26)
      expect(lines[0]).toBe('Title,Status,Price from')
      expect(lines[1]).toBe('Product 1,Draft,10.00')
      expect(lines[25]).toBe('Product 25,Draft,10.00')
    })
  })

  describe('exporting every page', () => {
    it('reads all pages 100 at a time and downloads one file with all 250 products', async () => {
      const { user, dialog } = await openDialog()
      await user.click(within(dialog).getByRole('radio', { name: 'CSV (.csv)' }))
      await user.click(within(dialog).getByRole('checkbox', { name: /Export all/ }))
      await user.click(exportButton(dialog))

      await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
      expect(
        exportCalls()
          .map(([params]) => params.page)
          .sort(),
      ).toEqual([1, 2, 3])
      const { filename, text } = await lastDownload()
      expect(filename).toMatch(/^products-all-\d{4}-\d{2}-\d{2}\.csv$/)
      const lines = rows(text)
      expect(lines).toHaveLength(251)
      expect(lines[1]).toContain('Product 1,')
      expect(lines[100]).toContain('Product 100,')
      expect(lines[101]).toContain('Product 101,')
      expect(lines[250]).toContain('Product 250,')
      expect(new Set(lines.slice(1).map((line) => line.split(',')[0])).size).toBe(250)
      expect(
        await screen.findByText(/Exported 250 products to products-all-/),
      ).toBeVisible()
    })

    it('exports what the list is narrowed to: the same search, filters and sort', async () => {
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
      // The advanced filters start from the list's own (there is no search box in them:
      // the list's search is simply kept).
      await user.click(within(dialog).getByRole('button', { name: /Advanced filters/ }))
      expect(within(dialog).queryByRole('searchbox', { name: 'Search' })).toBeNull()
      expect(within(dialog).getByRole('combobox', { name: 'Status' })).toHaveValue(
        'ARCHIVED',
      )
      expect(within(dialog).getByText('1 applied')).toBeInTheDocument()

      await user.click(within(dialog).getByRole('radio', { name: 'CSV (.csv)' }))
      await user.click(within(dialog).getByRole('checkbox', { name: /Export all/ }))
      // The list's own total, with no extra request.
      expect(within(dialog).getByText('40 products')).toBeInTheDocument()
      await user.click(exportButton(dialog))

      await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
      for (const [params] of exportCalls()) {
        expect(params).toMatchObject({
          search: 'desk',
          status: 'ARCHIVED',
          sort: 'created_at',
          order: 'desc',
          page_size: 100,
        })
      }
      expect(rows((await lastDownload()).text)).toHaveLength(41)
    })
  })

  describe('advanced filters', () => {
    it('are a closed accordion that opens on click, and can be changed with Current page ticked', async () => {
      const { user, dialog } = await openDialog()
      const toggle = within(dialog).getByRole('button', { name: /Advanced filters/ })
      expect(within(dialog).getByRole('checkbox', { name: /Current page/ })).toBeChecked()

      await user.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
      // Every filter works whichever rows are chosen.
      for (const name of ['Status', 'Stock', 'Product type', 'Tag']) {
        expect(within(dialog).getByRole('combobox', { name })).toBeEnabled()
      }
      expect(within(dialog).queryByRole('searchbox', { name: 'Search' })).toBeNull()
      expect(within(dialog).getByLabelText('Min price')).toBeEnabled()
      expect(within(dialog).getByLabelText('Max price')).toBeEnabled()
      await user.selectOptions(
        within(dialog).getByRole('combobox', { name: 'Stock' }),
        'in',
      )
      expect(within(dialog).getByRole('combobox', { name: 'Stock' })).toHaveValue('in')
      await user.type(within(dialog).getByLabelText('Max price'), '50')
      expect(within(dialog).getByLabelText('Max price')).toHaveValue(50)

      await user.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
    })

    it('with Current page, export that page of the products that match the changed filters', async () => {
      const { user, dialog } = await openDialog()
      await user.click(within(dialog).getByRole('button', { name: /Advanced filters/ }))
      await user.selectOptions(
        within(dialog).getByRole('combobox', { name: 'Status' }),
        'ARCHIVED',
      )

      // 40 archived products: page 1 of 25 has 25 of them.
      expect(await within(dialog).findByText('25 products')).toBeInTheDocument()
      expect(
        within(dialog).getByText('Page 1 of the products that match'),
      ).toBeInTheDocument()
      await user.click(within(dialog).getByRole('radio', { name: 'CSV (.csv)' }))
      list.mockClear()
      await user.click(exportButton(dialog))

      await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
      // One request, for the list's page and size, with the dialog's filter.
      expect(list).toHaveBeenCalledTimes(1)
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ARCHIVED', page: 1, page_size: 25 }),
      )
      const { filename, text } = await lastDownload()
      expect(filename).toMatch(/^products-page-1-\d{4}-\d{2}-\d{2}\.csv$/)
      expect(rows(text)).toHaveLength(26)
      expect(
        await screen.findByText(/Exported 25 products to products-page-1-/),
      ).toBeVisible()
    })

    it('with Current page and the list’s own filters, still exports the rows on screen with no request', async () => {
      const { user, dialog } = await openDialog()
      await user.click(within(dialog).getByRole('button', { name: /Advanced filters/ }))
      // Changed and changed back: the same as the list's.
      const status = within(dialog).getByRole('combobox', { name: 'Status' })
      await user.selectOptions(status, 'DRAFT')
      await user.selectOptions(status, '')
      expect(within(dialog).getByText('The 25 products shown here')).toBeInTheDocument()
      list.mockClear()
      await user.click(exportButton(dialog))

      expect(list).not.toHaveBeenCalled()
      expect(download).toHaveBeenCalledTimes(1)
    })

    it('counts the list’s page of the matches: page 2 of the 40 archived has 15', async () => {
      const user = userEvent.setup()
      renderPage()
      await screen.findByText('Product 1')
      // Page 2 of the 25-a-page list.
      await user.click(screen.getByRole('button', { name: 'Page 2' }))
      await screen.findByText('Product 26')
      await user.click(screen.getByRole('button', { name: 'Export' }))
      const dialog = await screen.findByRole('dialog', { name: 'Export products' })
      await user.click(within(dialog).getByRole('button', { name: /Advanced filters/ }))
      // 40 archived products: page 2 has the last 15.
      await user.selectOptions(
        within(dialog).getByRole('combobox', { name: 'Status' }),
        'ARCHIVED',
      )
      expect(await within(dialog).findByText('15 products')).toBeInTheDocument()
      expect(exportButton(dialog)).toBeEnabled()
    })

    it('narrow the export, counting the products that match as you change them', async () => {
      const { user, dialog } = await openDialog()
      await user.click(within(dialog).getByRole('checkbox', { name: /Export all/ }))
      await user.click(within(dialog).getByRole('button', { name: /Advanced filters/ }))
      list.mockClear()

      await user.selectOptions(
        within(dialog).getByRole('combobox', { name: 'Status' }),
        'ARCHIVED',
      )
      await user.type(within(dialog).getByLabelText('Max price'), '50')

      // One one-row request per pause in changing, then the answer.
      expect(await within(dialog).findByText('40 products')).toBeInTheDocument()
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ARCHIVED',
          max_price: 50,
          page: 1,
          page_size: 1,
        }),
      )
      expect(within(dialog).getByText('2 applied')).toBeInTheDocument()

      // The export itself carries those filters.
      await user.click(within(dialog).getByRole('radio', { name: 'CSV (.csv)' }))
      await user.click(exportButton(dialog))
      await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
      for (const [params] of exportCalls()) {
        expect(params).toMatchObject({ status: 'ARCHIVED', max_price: 50 })
      }
    })

    it('can be cleared back to the list’s own filters with Reset to default', async () => {
      const { user, dialog } = await openDialog()
      await user.click(within(dialog).getByRole('checkbox', { name: /Export all/ }))
      await user.click(within(dialog).getByRole('button', { name: /Advanced filters/ }))
      await user.selectOptions(
        within(dialog).getByRole('combobox', { name: 'Status' }),
        'DRAFT',
      )
      expect(within(dialog).getByText('1 applied')).toBeInTheDocument()

      await user.click(within(dialog).getByRole('button', { name: 'Reset to default' }))

      expect(within(dialog).getByRole('combobox', { name: 'Status' })).toHaveValue('')
      expect(within(dialog).queryByText('1 applied')).not.toBeInTheDocument()
    })
  })

  describe('while reading every page', () => {
    async function startAll() {
      const { user, dialog } = await openDialog()
      await user.click(within(dialog).getByRole('checkbox', { name: /Export all/ }))
      await user.click(exportButton(dialog))
      return user
    }

    it('shows progress, and Cancel stops it without downloading anything', async () => {
      // The first page arrives; the others never do.
      list.mockImplementation((params) =>
        params.page_size === 100 && (params.page ?? 1) > 1
          ? new Promise<never>(() => undefined)
          : Promise.resolve(respond(params)),
      )
      const user = await startAll()

      expect(await screen.findByText(/Exporting…\s*100 of 250/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled()

      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByText(/Exporting…/)).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled()
      expect(download).not.toHaveBeenCalled()
    })

    it('shows the backend’s message and downloads nothing when a page cannot be read', async () => {
      list.mockImplementation((params) =>
        params.page_size === 100 && params.page === 2
          ? Promise.reject(
              new ApiError('The server is busy. Try again.', { status: 503 }),
            )
          : Promise.resolve(respond(params)),
      )
      const user = await startAll()

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
