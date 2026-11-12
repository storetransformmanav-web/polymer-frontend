import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api/ApiError.ts'
import {
  api,
  type OrderListItem,
  type OrderListParams,
  type OrderListResponse,
} from '../../../lib/api/endpoints.ts'
import { downloadBlob } from '../../../lib/download.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { OrdersPage } from './OrdersPage.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    orders: { list: vi.fn(), export: vi.fn() },
    shops: { list: vi.fn() },
    products: {},
    customers: {},
    auth: {},
  },
}))
vi.mock('../../../lib/download.ts', () => ({ downloadBlob: vi.fn() }))

function makeOrder(n: number): OrderListItem {
  return {
    id: `order-${n}`,
    shopify_id: 14000000000000 + n,
    name: `#${17000 + n}`,
    order_number: 17000 + n,
    email: null,
    customer: null,
    shop: null,
    currency: 'GBP',
    total_price: '10.00',
    financial_status: 'PAID',
    fulfillment_status: 'FULFILLED',
    payment_gateway_names: [],
    tags: [],
    items_count: 1,
    line_items_preview: [],
    shopify_created_at: '2026-10-22T10:20:00Z',
  } as OrderListItem
}

function respond(params: OrderListParams): OrderListResponse {
  return {
    items: [makeOrder(1), makeOrder(2)],
    page: params.page ?? 1,
    page_size: params.page_size ?? 25,
    total: 250,
    total_pages: 10,
    has_next: true,
    sort: params.sort ?? 'created_at',
    order: params.order ?? 'desc',
  }
}

const list = vi.mocked(api.orders.list)
const exportCsv = vi.mocked(api.orders.export)
const shopsList = vi.mocked(api.shops.list)
const download = vi.mocked(downloadBlob)

async function openDialog() {
  const user = userEvent.setup()
  renderWithProviders(<OrdersPage />)
  await screen.findByText('17002')
  await user.click(screen.getByRole('button', { name: 'Export' }))
  const dialog = await screen.findByRole('dialog', { name: 'Export orders' })
  return { user, dialog }
}

describe('Exporting orders (GET /orders/export)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    list.mockImplementation((params) => Promise.resolve(respond(params)))
    shopsList.mockResolvedValue([])
    exportCsv.mockResolvedValue('Name,Email\n#17001,\n')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('sends nothing until asked, and exports the page by default', async () => {
    const { user, dialog } = await openDialog()
    expect(exportCsv).not.toHaveBeenCalled()

    expect(within(dialog).getByRole('radio', { name: 'Current page' })).toBeChecked()
    await user.click(within(dialog).getByRole('button', { name: 'Export orders' }))

    await waitFor(() =>
      expect(exportCsv).toHaveBeenCalledWith(
        { ids: 'order-1,order-2' },
        expect.any(AbortSignal),
      ),
    )
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
    const [filename, blob] = download.mock.calls[0]
    expect(filename).toMatch(/^orders_export_all-stores_\d{8}-\d{4}\.csv$/)
    expect(blob.type).toBe('text/csv;charset=utf-8')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findByText(/Exported 2 orders to/)).toBeInTheDocument()
  })

  it('All orders asks for the store only, whatever the list is narrowed to', async () => {
    const { user, dialog } = await openDialog()

    await user.click(within(dialog).getByRole('radio', { name: /^All orders/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Export orders' }))

    await waitFor(() =>
      expect(exportCsv).toHaveBeenCalledWith({}, expect.any(AbortSignal)),
    )
    expect(await screen.findByText(/Exported all orders to/)).toBeInTheDocument()
  })

  it('“matching” sends the list’s own search, filters and dates, without paging', async () => {
    const { user, dialog } = await openDialog()

    await user.click(
      within(dialog).getByRole('radio', { name: /250 orders matching your search/ }),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Export orders' }))

    await waitFor(() => expect(exportCsv).toHaveBeenCalledTimes(1))
    const [params] = exportCsv.mock.calls[0]
    // The page starts on the last 30 days, so the dates go along; the paging never does.
    expect(params).toEqual({ from: expect.any(String), to: expect.any(String) })
    expect(await screen.findByText(/Exported 250 orders to/)).toBeInTheDocument()
  })

  it('shows the backend’s message on failure and downloads nothing', async () => {
    exportCsv.mockRejectedValue(new ApiError('Export is not allowed.', { status: 403 }))
    const { user, dialog } = await openDialog()

    await user.click(within(dialog).getByRole('button', { name: 'Export orders' }))

    expect(await screen.findByText('Export is not allowed.')).toBeInTheDocument()
    expect(download).not.toHaveBeenCalled()
  })
})
