import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api/ApiError.ts'
import { api, type ProductListResponse, type Shop } from '../../../lib/api/endpoints.ts'
import type {
  ProductImportPlan,
  ProductImportProgress,
} from '../../../lib/api/productImport.ts'
import { buildCsv } from '../../../lib/csv.ts'
import { downloadBlob } from '../../../lib/download.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { ProductsImport } from './ProductsImport.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    shops: { list: vi.fn() },
    products: { list: vi.fn(), import: vi.fn(), importStatus: vi.fn() },
    auth: {},
  },
}))
vi.mock('../../../lib/download.ts', () => ({ downloadBlob: vi.fn() }))

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

const PAGE: ProductListResponse = {
  items: [],
  page: 1,
  page_size: 25,
  total: 0,
  total_pages: 1,
  has_next: false,
  sort: 'created_at',
  order: 'desc',
}

const HEADERS = [
  'Handle',
  'Title',
  'Body (HTML)',
  'Vendor',
  'Option1 Value',
  'Variant SKU',
  'Variant Grams',
  'Variant Price',
  'Image Src',
  'Status',
]
const row = (values: Record<string, string>) => HEADERS.map((name) => values[name] ?? '')

/** Two products: the first has two variants and two pictures. */
const CSV = buildCsv(HEADERS, [
  row({
    Handle: 'hippo-container',
    Title: 'Hippo Microwavable Container & Lid',
    'Body (HTML)': '<p>Hippo Microwavable Container</p>',
    Vendor: 'Packaging By Polymer',
    'Option1 Value': '500ml',
    'Variant SKU': 'MC01H',
    'Variant Grams': '9000',
    'Variant Price': '24.9',
    'Image Src': 'https://cdn.example.com/a.jpg',
    Status: 'active',
  }),
  row({
    Handle: 'hippo-container',
    'Option1 Value': '650ml',
    'Variant SKU': 'MC02H',
    'Variant Grams': '9000',
    'Variant Price': '25.5',
    'Image Src': 'https://cdn.example.com/b.jpg',
  }),
  row({ Handle: 'mop', Title: 'Mop', 'Variant SKU': 'MOP1', 'Variant Price': '5' }),
])

const csvFile = (name = 'products_export_all-stores.csv', text = CSV) =>
  new File([text], name, { type: 'text/csv' })

const CHECK: ProductImportPlan = {
  importId: null,
  message: '',
  counts: { to_create: 1, to_update: 1 },
  problems: [{ row: 4, handle: 'mop', message: 'Variant Price is not a number' }],
}
const STARTED: ProductImportPlan = {
  importId: 'imp-1',
  message: 'Import started',
  counts: {},
  problems: [],
}
const RUNNING: ProductImportProgress = {
  state: 'running',
  status: 'running',
  processed: 1,
  total: 2,
  message: '',
  counts: { created: 1 },
  problems: [],
}
const DONE: ProductImportProgress = {
  state: 'done',
  status: 'completed',
  processed: 2,
  total: 2,
  message: 'Imported 2 products.',
  counts: { created: 1, updated: 1 },
  problems: [{ row: 4, handle: 'mop', message: 'Variant Price is not a number' }],
}

const list = vi.mocked(api.products.list)
const importCsv = vi.mocked(api.products.import)
const importStatus = vi.mocked(api.products.importStatus)

describe('importing products from a CSV', () => {
  beforeEach(() => {
    vi.mocked(api.shops.list).mockResolvedValue([SHOP])
    list.mockResolvedValue(PAGE)
    importCsv.mockImplementation(async (_file, options) =>
      options.dryRun ? CHECK : STARTED,
    )
    importStatus.mockResolvedValue(DONE)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  async function open(user = userEvent.setup()) {
    renderWithProviders(<ProductsImport />)
    await user.click(await screen.findByRole('button', { name: 'Import' }))
    const dialog = await screen.findByRole('dialog', { name: 'Import products' })
    return { user, dialog }
  }

  async function openWithFile(user = userEvent.setup(), file = csvFile()) {
    const opened = await open(user)
    await user.upload(within(opened.dialog).getByLabelText('Choose a CSV file'), file)
    await within(opened.dialog).findByText(/2 products/)
    return opened
  }

  async function reachReview() {
    const opened = await openWithFile()
    await opened.user.click(
      within(opened.dialog).getByRole('button', { name: 'Upload file' }),
    )
    const review = await screen.findByRole('dialog', {
      name: 'Preview your first product',
    })
    return { ...opened, review }
  }

  describe('the first screen', () => {
    it('has an Import button that opens the dialog, with nothing requested yet', async () => {
      const { dialog } = await open()

      expect(within(dialog).getByText('Bulk import via CSV')).toBeInTheDocument()
      expect(
        within(dialog).getByRole('button', { name: 'Download sample CSV' }),
      ).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Add file' })).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Upload file' })).toBeDisabled()
      expect(importCsv).not.toHaveBeenCalled()
    })

    it('starts with both choices ticked and the first store picked', async () => {
      const { dialog } = await open()

      expect(
        within(dialog).getByRole('checkbox', {
          name: 'Overwrite products with matching handles.',
        }),
      ).toBeChecked()
      expect(
        within(dialog).getByRole('checkbox', { name: 'Create new products.' }),
      ).toBeChecked()
      await waitFor(() =>
        expect(within(dialog).getByLabelText('Store')).toHaveValue('polymer-uk'),
      )
    })

    it('shows the chosen file, its size and how many products it holds, and lets it be replaced', async () => {
      const { dialog } = await openWithFile()

      expect(
        within(dialog).getByText('products_export_all-stores.csv'),
      ).toBeInTheDocument()
      expect(within(dialog).getByText(/KB · 2 products/)).toBeInTheDocument()
      expect(
        within(dialog).getByRole('button', { name: 'Replace file' }),
      ).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Upload file' })).toBeEnabled()
    })

    it('refuses a file that is not a CSV, saying which', async () => {
      const user = userEvent.setup({ applyAccept: false })
      const { dialog } = await open(user)
      await user.upload(
        within(dialog).getByLabelText('Choose a CSV file'),
        new File(['hello'], 'notes.txt', { type: 'text/plain' }),
      )

      expect(
        await within(dialog).findByText(/“notes.txt” isn’t a CSV file/),
      ).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Upload file' })).toBeDisabled()
    })

    it('refuses a CSV that is not in Shopify’s layout (no Handle column)', async () => {
      const user = userEvent.setup()
      const { dialog } = await open(user)
      await user.upload(
        within(dialog).getByLabelText('Choose a CSV file'),
        csvFile('prices.csv', 'Name,Price\nMop,5\n'),
      )

      expect(await within(dialog).findByText(/no “Handle” column/)).toBeInTheDocument()
      expect(within(dialog).queryByText('prices.csv')).not.toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Upload file' })).toBeDisabled()
    })

    it('will not go on with both choices unticked', async () => {
      const { user, dialog } = await openWithFile()
      await user.click(
        within(dialog).getByRole('checkbox', {
          name: 'Overwrite products with matching handles.',
        }),
      )
      await user.click(
        within(dialog).getByRole('checkbox', { name: 'Create new products.' }),
      )

      expect(within(dialog).getByRole('button', { name: 'Upload file' })).toBeDisabled()
      expect(within(dialog).getByRole('alert')).toHaveTextContent('Choose at least one')
    })

    it('downloads a sample CSV', async () => {
      const { user, dialog } = await open()
      await user.click(
        within(dialog).getByRole('button', { name: 'Download sample CSV' }),
      )

      expect(downloadBlob).toHaveBeenCalledTimes(1)
      expect(vi.mocked(downloadBlob).mock.calls[0][0]).toBe('sample-products-import.csv')
    })

    it('closes with the ✕ or Cancel, forgetting the file', async () => {
      const { user, dialog } = await openWithFile()
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Import' }))
      const again = await screen.findByRole('dialog', { name: 'Import products' })
      expect(
        within(again).queryByText('products_export_all-stores.csv'),
      ).not.toBeInTheDocument()
    })
  })

  describe('uploading the file for a check', () => {
    it('sends the file with dry_run=true and the choices, once, then shows the preview', async () => {
      const { review } = await reachReview()

      expect(importCsv).toHaveBeenCalledTimes(1)
      const [file, options] = importCsv.mock.calls[0]
      expect(file.name).toBe('products_export_all-stores.csv')
      expect(options).toEqual({
        shop: 'polymer-uk',
        dryRun: true,
        createNew: true,
        updateExisting: true,
      })
      expect(review).toBeInTheDocument()
    })

    it('sends the choices that were made', async () => {
      const { user, dialog } = await openWithFile()
      await user.click(
        within(dialog).getByRole('checkbox', {
          name: 'Overwrite products with matching handles.',
        }),
      )
      await user.click(within(dialog).getByRole('button', { name: 'Upload file' }))
      const review = await screen.findByRole('dialog', {
        name: 'Preview your first product',
      })

      expect(importCsv.mock.calls[0][1]).toMatchObject({
        createNew: true,
        updateExisting: false,
      })
      expect(within(review).getByText(/create new products only/)).toBeInTheDocument()
    })

    it('stays on the first screen with the backend’s message when the check fails, and can be tried again', async () => {
      importCsv.mockRejectedValueOnce(
        new ApiError('The file is not in the right layout.', { status: 422 }),
      )
      const { user, dialog } = await openWithFile()
      await user.click(within(dialog).getByRole('button', { name: 'Upload file' }))

      expect(
        await within(dialog).findByText('The file is not in the right layout.'),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('dialog', { name: 'Preview your first product' }),
      ).toBeNull()

      await user.click(within(dialog).getByRole('button', { name: 'Upload file' }))
      expect(
        await screen.findByRole('dialog', { name: 'Preview your first product' }),
      ).toBeInTheDocument()
      expect(importCsv).toHaveBeenCalledTimes(2)
    })
  })

  describe('the preview', () => {
    it('says what the file holds: products, variants and images, for the store', async () => {
      const { review } = await reachReview()

      expect(review).toHaveTextContent(
        'You will be importing approximately 2 products with a total of 3 variants and 2 images into Polymer UK.',
      )
      expect(review).toHaveTextContent('overwrite any existing products')
    })

    it('shows the first product as it will look', async () => {
      const { review } = await reachReview()

      const field = (label: string) =>
        within(review).getByText(label, { selector: 'dt' }).nextElementSibling
      expect(field('Title')).toHaveTextContent('Hippo Microwavable Container & Lid')
      expect(field('Description')).toHaveTextContent('Hippo Microwavable Container')
      expect(field('Product Status')).toHaveTextContent('Active')
      expect(field('Vendor')).toHaveTextContent('Packaging By Polymer')
      expect(field('Product Category')).toHaveTextContent('—')
    })

    it('lists its variants with SKU, weight and the price in the store’s currency', async () => {
      const { review } = await reachReview()

      const rows = within(review).getAllByRole('row')
      expect(rows[0]).toHaveTextContent('VariantSKUWeightPrice')
      expect(rows[1]).toHaveTextContent('500mlMC01H9000.00g£24.90')
      expect(rows[2]).toHaveTextContent('650mlMC02H9000.00g£25.50')
    })

    it('reports what the store’s check found: the rows it will skip, and its figures', async () => {
      const { review } = await reachReview()

      expect(
        within(review).getByRole('group', {
          name: '1 row had a problem and will be skipped',
        }),
      ).toHaveTextContent('Row 4 · mop — Variant Price is not a number')
      expect(within(review).getByLabelText('Figures from the store')).toHaveTextContent(
        'To create1',
      )
    })

    it('goes back to choose a different file', async () => {
      const { user, review } = await reachReview()
      await user.click(
        within(review).getByRole('button', { name: 'choose a different file' }),
      )

      expect(
        await screen.findByRole('dialog', { name: 'Import products' }),
      ).toBeInTheDocument()
      expect(importCsv).toHaveBeenCalledTimes(1)
    })

    it('starts nothing until Import products, and Cancel leaves nothing behind', async () => {
      const { user, review } = await reachReview()
      await user.click(within(review).getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      // Only the check was ever sent.
      expect(importCsv).toHaveBeenCalledTimes(1)
      expect(importCsv.mock.calls[0][1].dryRun).toBe(true)
    })
  })

  describe('importing', () => {
    async function startImport() {
      const reached = await reachReview()
      await reached.user.click(
        within(reached.review).getByRole('button', { name: 'Import products' }),
      )
      return reached
    }

    it('sends the real import (dry_run=false) and follows it by its id', async () => {
      importStatus.mockResolvedValue(RUNNING)
      await startImport()

      expect(await screen.findByText(/Importing your products/)).toBeInTheDocument()
      expect(importCsv).toHaveBeenCalledTimes(2)
      expect(importCsv.mock.calls[1][1]).toEqual({
        shop: 'polymer-uk',
        dryRun: false,
        createNew: true,
        updateExisting: true,
      })
      await waitFor(() => expect(importStatus).toHaveBeenCalledWith('imp-1'))
    })

    it('shows how far it is, then how it ended — with the skipped rows — and re-reads the list', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      importStatus.mockResolvedValueOnce(RUNNING).mockResolvedValue(DONE)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const opened = await open(user)
      await user.upload(
        within(opened.dialog).getByLabelText('Choose a CSV file'),
        csvFile(),
      )
      await within(opened.dialog).findByText(/2 products/)
      await user.click(within(opened.dialog).getByRole('button', { name: 'Upload file' }))
      const review = await screen.findByRole('dialog', {
        name: 'Preview your first product',
      })
      list.mockClear()
      await user.click(within(review).getByRole('button', { name: 'Import products' }))

      // The figures are in the window and, behind it, in the top bar.
      const running = await screen.findByRole('dialog', { name: 'Importing products' })
      expect(await within(running).findByText(/1 of 2/)).toBeInTheDocument()
      expect(
        screen.getByRole('progressbar', { name: 'Import progress' }),
      ).toHaveAttribute('aria-valuenow', '50')

      await act(() => vi.advanceTimersByTimeAsync(2100))

      const done = await screen.findByRole('dialog', { name: 'Import finished' })
      expect(within(done).getByText('Imported 2 products.')).toBeInTheDocument()
      expect(within(done).getByLabelText('Figures from the store')).toHaveTextContent(
        'Created1',
      )
      expect(
        within(done).getByRole('group', { name: '1 row was skipped' }),
      ).toHaveTextContent('Row 4 · mop — Variant Price is not a number')
      // The list is re-read once the import has ended.
      await waitFor(() => expect(list).toHaveBeenCalled())
    })

    it('says so, with the backend’s message, when the import fails', async () => {
      importStatus.mockResolvedValue({
        ...DONE,
        state: 'failed',
        status: 'failed',
        message: 'The store refused the import.',
      })
      await startImport()

      const failed = await screen.findByRole('dialog', {
        name: 'The import ran into a problem',
      })
      expect(
        within(failed).getByText('The store refused the import.'),
      ).toBeInTheDocument()
    })

    it('goes back to the preview with the message when starting fails, and can be started again', async () => {
      importCsv.mockImplementation(async (_file, options) => {
        if (options.dryRun) return CHECK
        throw new ApiError('Too many imports at once.', { status: 429 })
      })
      const { user, review } = await reachReview()
      await user.click(within(review).getByRole('button', { name: 'Import products' }))

      expect(
        await within(review).findByText('Too many imports at once.'),
      ).toBeInTheDocument()
      expect(
        within(review).getByRole('button', { name: 'Import products' }),
      ).toBeEnabled()
    })

    it('keeps going in the top bar when the window is closed, and View brings it back', async () => {
      importStatus.mockResolvedValue(RUNNING)
      const { user } = await startImport()
      const progress = await screen.findByRole('dialog', { name: 'Importing products' })
      await user.click(within(progress).getByRole('button', { name: 'Close' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      const bar = screen.getByRole('status')
      expect(bar).toHaveTextContent('Importing…')
      await user.click(within(bar).getByRole('button', { name: 'View' }))
      expect(
        await screen.findByRole('dialog', { name: 'Importing products' }),
      ).toBeInTheDocument()
    })

    it('shows the result in the bar after the window was closed, and Dismiss clears it', async () => {
      const { user } = await startImport()
      const done = await screen.findByRole('dialog', { name: 'Import finished' })
      await user.click(within(done).getByRole('button', { name: 'Close' }))

      expect(screen.getByRole('status')).toHaveTextContent('Import finished')
      await user.click(screen.getByRole('button', { name: 'Dismiss' }))
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('still reports an import it cannot follow (an answer with no id) as sent, and re-reads the list', async () => {
      importCsv.mockImplementation(async (_file, options) =>
        options.dryRun
          ? CHECK
          : { importId: null, message: 'Import queued.', counts: {}, problems: [] },
      )
      list.mockClear()
      await startImport()

      const sent = await screen.findByRole('dialog', { name: 'Import in progress' })
      expect(within(sent).getByText('Import queued.')).toBeInTheDocument()
      expect(importStatus).not.toHaveBeenCalled()
      await waitFor(() => expect(list).toHaveBeenCalled())
    })
  })
})
