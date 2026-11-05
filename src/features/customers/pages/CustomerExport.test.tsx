import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api/ApiError.ts'
import {
  api,
  type CustomerListItem,
  type CustomerListParams,
  type CustomerListResponse,
} from '../../../lib/api/endpoints.ts'
import { downloadBlob } from '../../../lib/download.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { CustomersPage } from './CustomersPage.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: {
    customers: { list: vi.fn(), export: vi.fn() },
    shops: { list: vi.fn() },
    products: {},
    auth: {},
  },
}))
vi.mock('../../../lib/download.ts', () => ({ downloadBlob: vi.fn() }))

function makeCustomer(n: number): CustomerListItem {
  return {
    shop: null,
    id: `cust-${n}`,
    shopify_id: 1000 + n,
    email: `customer${n}@example.com`,
    full_name: `Customer ${n}`,
    first_name: null,
    last_name: null,
    phone: null,
    role: 'subscriber',
    is_active: true,
    shopify_state: 'ENABLED',
    accepts_marketing: false,
    orders_count: 0,
    total_spent: '0',
    currency: 'GBP',
    tags: [],
    city: null,
    country: null,
    last_order_name: null,
    shopify_created_at: null,
    last_login_at: null,
  }
}

function respond(params: CustomerListParams): CustomerListResponse {
  return {
    items: [makeCustomer(1), makeCustomer(2)],
    page: params.page ?? 1,
    page_size: params.page_size ?? 25,
    total: 250,
    total_pages: 10,
    has_next: true,
    sort: params.sort ?? 'created_at',
    order: params.order ?? 'desc',
  }
}

const list = vi.mocked(api.customers.list)
const exportCsv = vi.mocked(api.customers.export)
const shopsList = vi.mocked(api.shops.list)
const download = vi.mocked(downloadBlob)

async function openDialog() {
  const user = userEvent.setup()
  renderWithProviders(<CustomersPage />)
  await screen.findByText('Customer 2')
  await user.click(screen.getByRole('button', { name: 'Export' }))
  const dialog = await screen.findByRole('dialog', { name: 'Export customers' })
  return { user, dialog }
}

describe('Exporting customers (GET /customer/export)', () => {
  beforeEach(() => {
    list.mockImplementation((params) => Promise.resolve(respond(params)))
    shopsList.mockResolvedValue([])
    exportCsv.mockResolvedValue('Email\ncustomer1@example.com\n')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('sends nothing until asked, and exports the page by default', async () => {
    const { user, dialog } = await openDialog()
    expect(exportCsv).not.toHaveBeenCalled()

    expect(within(dialog).getByRole('radio', { name: 'Current page' })).toBeChecked()
    await user.click(within(dialog).getByRole('button', { name: 'Export customers' }))

    await waitFor(() =>
      expect(exportCsv).toHaveBeenCalledWith(
        { role: 'all', ids: 'cust-1,cust-2' },
        expect.any(AbortSignal),
      ),
    )
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
    const [filename, blob] = download.mock.calls[0]
    expect(filename).toMatch(/^customers_export_all-stores_\d{8}-\d{4}\.csv$/)
    expect(blob.type).toBe('text/csv;charset=utf-8')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findByText(/Exported 2 customers to/)).toBeInTheDocument()
  })

  it('All customers asks for every role, whatever the list is narrowed to', async () => {
    const { user, dialog } = await openDialog()

    await user.click(within(dialog).getByRole('radio', { name: /^All customers/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Export customers' }))

    await waitFor(() =>
      expect(exportCsv).toHaveBeenCalledWith({ role: 'all' }, expect.any(AbortSignal)),
    )
    expect(await screen.findByText(/Exported all customers to/)).toBeInTheDocument()
  })

  it('“matching your search” is off until the list is searched or filtered', async () => {
    const { dialog } = await openDialog()
    expect(
      within(dialog).getByRole('radio', { name: /matching your search/ }),
    ).toBeDisabled()
  })

  it('shows the backend’s message on failure and downloads nothing', async () => {
    exportCsv.mockRejectedValue(new ApiError('Export is not allowed.', { status: 403 }))
    const { user, dialog } = await openDialog()

    await user.click(within(dialog).getByRole('button', { name: 'Export customers' }))

    expect(await screen.findByText('Export is not allowed.')).toBeInTheDocument()
    expect(download).not.toHaveBeenCalled()
  })
})
