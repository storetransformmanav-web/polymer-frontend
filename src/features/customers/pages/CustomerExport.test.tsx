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
  api: { customers: { list: vi.fn() }, products: {}, auth: {} },
}))
vi.mock('../../../lib/download.ts', () => ({ downloadBlob: vi.fn() }))

const TOTAL = 250
/** The fake server has fewer administrators than customers overall. */
const ADMIN_TOTAL = 40

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
    accepts_marketing: n % 2 === 0,
    orders_count: n % 4,
    total_spent: '45.70',
    currency: 'GBP',
    tags: [],
    city: null,
    country: 'United Kingdom',
    last_order_name: null,
    shopify_created_at: null,
    last_login_at: null,
  }
}

/** A fake server with 250 customers (40 administrators), paged by page/page_size. */
function respond(params: CustomerListParams): CustomerListResponse {
  const total = params.role === 'administrator' ? ADMIN_TOTAL : TOTAL
  const page = params.page ?? 1
  const pageSize = params.page_size ?? 25
  const start = (page - 1) * pageSize
  const count = Math.max(0, Math.min(pageSize, total - start))
  return {
    items: Array.from({ length: count }, (_, i) => makeCustomer(start + i + 1)),
    page,
    page_size: pageSize,
    total,
    total_pages: Math.ceil(total / pageSize),
    has_next: start + count < total,
    sort: params.sort ?? 'created_at',
    order: params.order ?? 'desc',
  }
}

const list = vi.mocked(api.customers.list)
const download = vi.mocked(downloadBlob)

/** Requests the export made: whole pages of 100, not the list's own 25. */
const exportCalls = () => list.mock.calls.filter(([params]) => params.page_size === 100)

async function openDialog() {
  const user = userEvent.setup()
  renderWithProviders(<CustomersPage />)
  await screen.findByText('Customer 2')
  await user.click(screen.getByRole('button', { name: 'Export' }))
  const dialog = await screen.findByRole('dialog', { name: 'Export customers' })
  return { user, dialog }
}

async function lastDownload() {
  const [filename, blob] = download.mock.calls.at(-1)!
  return { filename, blob, text: await blob.text() }
}
const rows = (csv: string) => csv.split('\r\n').filter((line) => line !== '')
const exportButton = (dialog: HTMLElement) =>
  within(dialog).getByRole('button', { name: 'Export' })

describe('exporting customers', () => {
  beforeEach(() => {
    list.mockImplementation((params) => Promise.resolve(respond(params)))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('opens the same export dialog: Excel or CSV (no PDF, no date range), every column, rows and advanced filters', async () => {
    const { dialog } = await openDialog()

    expect(within(dialog).getByRole('radio', { name: 'Excel (.xlsx)' })).toBeChecked()
    expect(within(dialog).getByRole('radio', { name: 'CSV (.csv)' })).not.toBeChecked()
    expect(within(dialog).queryByText(/pdf/i)).not.toBeInTheDocument()
    expect(within(dialog).queryByText(/date range/i)).not.toBeInTheDocument()

    expect(within(dialog).getByText('20 selected')).toBeInTheDocument()
    for (const name of [
      'Customer ID',
      'Customer name',
      'Email',
      'Email subscription',
      'Orders',
      'Amount spent',
      'Country',
      'Last login',
    ]) {
      expect(within(dialog).getByRole('checkbox', { name })).toBeChecked()
    }
    expect(within(dialog).getByRole('checkbox', { name: /Current page/ })).toBeChecked()
    expect(within(dialog).getByRole('checkbox', { name: /Export all/ })).not.toBeChecked()
    expect(
      within(dialog).getByRole('button', { name: /Advanced filters/ }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(within(dialog).getByText('25 customers')).toBeInTheDocument()
  })

  it('closes with Cancel or Escape and exports nothing', async () => {
    const { user, dialog } = await openDialog()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Export' }))
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(download).not.toHaveBeenCalled()
  })

  it('downloads the current page as an Excel file at once, with nothing requested', async () => {
    const { user, dialog } = await openDialog()
    list.mockClear()
    await user.click(exportButton(dialog))

    expect(list).not.toHaveBeenCalled()
    const { filename, blob } = await lastDownload()
    expect(filename).toMatch(/^customers-page-1-\d{4}-\d{2}-\d{2}\.xlsx$/)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect([...bytes.slice(0, 2)]).toEqual([0x50, 0x4b])
    expect(
      await screen.findByText(/Exported 25 customers to customers-page-1-.*\.xlsx/),
    ).toBeVisible()
  })

  it('downloads a CSV of only the chosen columns', async () => {
    const { user, dialog } = await openDialog()
    await user.click(within(dialog).getByRole('radio', { name: 'CSV (.csv)' }))
    await user.click(within(dialog).getByRole('button', { name: 'Clear' }))
    for (const name of ['Customer name', 'Email subscription', 'Orders']) {
      await user.click(within(dialog).getByRole('checkbox', { name }))
    }
    await user.click(exportButton(dialog))

    const { filename, text } = await lastDownload()
    expect(filename).toMatch(/^customers-page-1-\d{4}-\d{2}-\d{2}\.csv$/)
    const lines = rows(text.replace(/^﻿/, ''))
    expect(lines).toHaveLength(26)
    expect(lines[0]).toBe('Customer name,Email subscription,Orders')
    expect(lines[1]).toBe('Customer 1,Not subscribed,1')
    expect(lines[2]).toBe('Customer 2,Subscribed,2')
  })

  it('exports every page 100 at a time into one file, keeping the list’s role query', async () => {
    const { user, dialog } = await openDialog()
    await user.click(within(dialog).getByRole('radio', { name: 'CSV (.csv)' }))
    await user.click(within(dialog).getByRole('checkbox', { name: /Export all/ }))
    expect(within(dialog).getByText('250 customers')).toBeInTheDocument()
    await user.click(exportButton(dialog))

    await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
    expect(
      exportCalls()
        .map(([params]) => params.page)
        .sort(),
    ).toEqual([1, 2, 3])
    // "All Customers" always asks for every role.
    for (const [params] of exportCalls()) expect(params.role).toBe('all')
    const { filename, text } = await lastDownload()
    expect(filename).toMatch(/^customers-all-\d{4}-\d{2}-\d{2}\.csv$/)
    const lines = rows(text)
    expect(lines).toHaveLength(251)
    expect(lines[1]).toContain('Customer 1,')
    expect(lines[250]).toContain('Customer 250,')
    expect(new Set(lines.slice(1).map((line) => line.split(',')[0])).size).toBe(250)
    expect(
      await screen.findByText(/Exported 250 customers to customers-all-/),
    ).toBeVisible()
  })

  describe('advanced filters', () => {
    it('start from the list’s own filters', async () => {
      const user = userEvent.setup()
      renderWithProviders(<CustomersPage />)
      await screen.findByText('Customer 2')
      await user.click(screen.getByRole('button', { name: /^Administrators/ }))
      await waitFor(() =>
        expect(list).toHaveBeenCalledWith(
          expect.objectContaining({ role: 'administrator' }),
        ),
      )

      await user.click(screen.getByRole('button', { name: 'Export' }))
      const dialog = await screen.findByRole('dialog', { name: 'Export customers' })
      await user.click(within(dialog).getByRole('button', { name: /Advanced filters/ }))
      expect(within(dialog).getByRole('combobox', { name: 'Role' })).toHaveValue(
        'administrator',
      )
      expect(within(dialog).getByText('1 applied')).toBeInTheDocument()
      await user.click(within(dialog).getByRole('checkbox', { name: /Export all/ }))
      expect(within(dialog).getByText('40 customers')).toBeInTheDocument()
    })

    it('can be changed with Current page ticked, and then export that page of the matches', async () => {
      const { user, dialog } = await openDialog()
      expect(within(dialog).getByRole('checkbox', { name: /Current page/ })).toBeChecked()
      await user.click(within(dialog).getByRole('button', { name: /Advanced filters/ }))

      for (const name of [
        'Role',
        'Account State',
        'Marketing',
        'Orders',
        'Country',
        'Tag',
      ]) {
        expect(within(dialog).getByRole('combobox', { name })).toBeEnabled()
      }
      expect(within(dialog).queryByRole('searchbox', { name: 'Search' })).toBeNull()
      expect(within(dialog).getByLabelText('Min spent')).toBeEnabled()
      expect(within(dialog).getByLabelText('Max spent')).toBeEnabled()

      await user.selectOptions(
        within(dialog).getByRole('combobox', { name: 'Role' }),
        'administrator',
      )
      // 40 administrators: page 1 of 25 has 25 of them.
      expect(await within(dialog).findByText('25 customers')).toBeInTheDocument()
      expect(
        within(dialog).getByText('Page 1 of the customers that match'),
      ).toBeInTheDocument()
      await user.click(within(dialog).getByRole('radio', { name: 'CSV (.csv)' }))
      list.mockClear()
      await user.click(exportButton(dialog))

      await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
      expect(list).toHaveBeenCalledTimes(1)
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'administrator', page: 1, page_size: 25 }),
      )
      expect(rows((await lastDownload()).text)).toHaveLength(26)
    })

    it('narrow an export of everything, counting the customers that match as you change them', async () => {
      const { user, dialog } = await openDialog()
      await user.click(within(dialog).getByRole('checkbox', { name: /Export all/ }))
      await user.click(within(dialog).getByRole('button', { name: /Advanced filters/ }))
      list.mockClear()

      await user.selectOptions(
        within(dialog).getByRole('combobox', { name: 'Role' }),
        'administrator',
      )
      await user.selectOptions(
        within(dialog).getByRole('combobox', { name: 'Marketing' }),
        'yes',
      )
      await user.type(within(dialog).getByLabelText('Min spent'), '10')

      expect(await within(dialog).findByText('40 customers')).toBeInTheDocument()
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'administrator',
          accepts_marketing: true,
          min_spent: 10,
          page: 1,
          page_size: 1,
        }),
      )
      expect(within(dialog).getByText('3 applied')).toBeInTheDocument()

      await user.click(within(dialog).getByRole('radio', { name: 'CSV (.csv)' }))
      await user.click(exportButton(dialog))
      await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
      for (const [params] of exportCalls()) {
        expect(params).toMatchObject({
          role: 'administrator',
          accepts_marketing: true,
          min_spent: 10,
        })
      }
    })

    it('go back to the list’s own with Reset to default', async () => {
      const { user, dialog } = await openDialog()
      await user.click(within(dialog).getByRole('button', { name: /Advanced filters/ }))
      await user.selectOptions(
        within(dialog).getByRole('combobox', { name: 'Marketing' }),
        'no',
      )
      expect(within(dialog).getByText('1 applied')).toBeInTheDocument()

      await user.click(within(dialog).getByRole('button', { name: 'Reset to default' }))

      expect(within(dialog).getByRole('combobox', { name: 'Marketing' })).toHaveValue('')
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
      await user.click(screen.getByRole('button', { name: 'Dismiss' }))
      expect(screen.queryByText('The server is busy. Try again.')).not.toBeInTheDocument()
    })
  })

  it('is off when there are no customers', async () => {
    list.mockImplementation((params) =>
      Promise.resolve({ ...respond(params), items: [], total: 0, total_pages: 1 }),
    )
    renderWithProviders(<CustomersPage />)

    expect(await screen.findByText(/No customers found/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled()
  })
})
