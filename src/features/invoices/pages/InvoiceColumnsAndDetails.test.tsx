import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../lib/api/ApiError.ts'
import { api } from '../../../lib/api/endpoints.ts'
import { readInvoiceDetail } from '../../../lib/api/invoiceDetail.ts'
import type { Invoice, InvoiceListResponse } from '../../../lib/api/invoices.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { INVOICE_COLUMN_IDS, DEFAULT_VISIBLE_INVOICE_COLUMNS } from '../utils/columns.ts'
import { InvoicesPage } from './InvoicesPage.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: { invoices: { list: vi.fn() }, invoiceDetail: { get: vi.fn() }, auth: {} },
}))

const list = vi.mocked(api.invoices.list)
const getDetail = vi.mocked(api.invoiceDetail.get)

/** A made-up answer in the shape of GET /api/sage/invoices/{number}. */
const detailAnswer = (number: string) =>
  readInvoiceDetail({
    invoice_number: number,
    kind: 'invoice',
    kind_label: 'Invoice',
    invoice_date: '2026-11-10',
    currency: 'GBP',
    posted: true,
    customer_order_number: `PO-${number}`,
    customer_name: 'Acme Ltd',
    account_ref: 'ACC1',
    email: 'buyer@example.com',
    invoice_address: { address1: '1 High St', city: 'Leeds', postcode: 'LS1 1AA' },
    delivery_address: null,
    lines: [
      {
        position: 1,
        stock_code: 'BAG-1',
        description: 'Paper bag',
        quantity: 10,
        unit_price: 2.5,
        net: 25,
        tax_rate: 20,
        tax: 5,
        gross: 30,
      },
      { position: 2, description: 'Free text note' },
    ],
    totals: { total_net: 25, total_tax: 5, total_gross: 30 },
    vat_analysis: [{ rate: 20, net: 25, tax: 5 }],
    payment_status: 'part_paid',
    paid: 10,
    outstanding: 20,
    due_date: '2026-12-10',
    payments: [{ reference: 'PAY-7', amount: 10, date: '2026-11-12' }],
    notes: 'Leave at the gate',
  })

const invoice = (id: string, changes: Partial<Invoice> = {}): Invoice => ({
  id,
  number: `SI-${id}`,
  salesOrderNumber: `SO-${id}`,
  kind: 'invoice',
  date: '2026-11-10',
  dueDate: '2026-12-10',
  customerName: `Customer ${id}`,
  accountRef: `ACC${id}`,
  customerOrderNumber: `PO-${id}`,
  takenBy: 'Sam',
  net: 100,
  tax: 20,
  gross: 120,
  paid: 20,
  outstanding: 100,
  paymentStatus: 'part_paid',
  currency: 'GBP',
  ...changes,
})

const ANSWER: InvoiceListResponse = {
  items: [invoice('1'), invoice('2')],
  totals: {
    invoices: 2,
    net: 200,
    tax: 40,
    gross: 240,
    paid: 40,
    outstanding: 200,
    overdue: 0,
  },
  kindCounts: [{ kind: 'invoice', count: 2 }],
  page: 1,
  pageSize: 25,
  total: 2,
  totalPages: 1,
  hasNext: false,
}

function Path() {
  const location = useLocation()
  return <p data-testid="path">{location.pathname + location.search}</p>
}

function renderPage(route = '/sage/invoices') {
  return renderWithProviders(
    <>
      <Path />
      <Routes>
        <Route path="/sage/invoices/*" element={<InvoicesPage />} />
      </Routes>
    </>,
    { route },
  )
}

describe('the invoice table’s Columns menu', () => {
  beforeEach(() => {
    window.localStorage.clear()
    list.mockResolvedValue(ANSWER)
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('starts with eight default columns, the other seven hidden in the menu', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('SI-1')
    expect(INVOICE_COLUMN_IDS).toHaveLength(15)
    expect(DEFAULT_VISIBLE_INVOICE_COLUMNS).toHaveLength(8)

    await user.click(screen.getByRole('button', { name: 'Columns' }))
    for (const name of [
      'Invoice Number',
      'Invoice Date',
      'Due Date',
      'Customer',
      'Net',
      'Tax',
      'Gross',
      'Payment Status',
    ]) {
      expect(screen.getByRole('button', { name: `Hide ${name}` })).toBeInTheDocument()
    }
    for (const name of [
      'Customer Order Number',
      'Invoice Type',
      'Sales Order Number',
      'Taken By',
      'Customer Account Reference',
      'Paid Amount',
      'Outstanding Amount',
    ]) {
      expect(screen.getByRole('button', { name: `Show ${name}` })).toBeInTheDocument()
    }
  })

  it('shows and hides a column at once, and remembers the choice', async () => {
    const user = userEvent.setup()
    const { unmount } = renderPage()
    await screen.findByText('SI-1')
    const headers = () =>
      within(screen.getByRole('table'))
        .getAllByRole('columnheader')
        .map((header) => header.textContent)

    await user.click(screen.getByRole('button', { name: 'Columns' }))
    await user.click(screen.getByRole('button', { name: 'Show Outstanding Amount' }))
    await user.click(screen.getByRole('button', { name: 'Show Invoice Type' }))

    expect(headers()).toContain('Outstanding Amount')
    expect(headers()).toContain('Invoice Type')
    // Action is always last.
    expect(headers()[headers().length - 1]).toBe('Action')

    unmount()
    renderPage()
    await screen.findByText('SI-1')
    expect(headers()).toContain('Outstanding Amount')
    expect(headers()).toContain('Invoice Type')
  })

  it('puts the default columns back with Reset', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('SI-1')

    await user.click(screen.getByRole('button', { name: 'Columns' }))
    await user.click(screen.getByRole('button', { name: 'Hide Tax' }))
    await user.click(screen.getByRole('button', { name: 'Reset' }))

    const names = within(screen.getByRole('table'))
      .getAllByRole('columnheader')
      .map((header) => header.textContent)
    expect(names).toContain('Tax')
  })
})

describe('a customer and an invoice open as pages of their own', () => {
  beforeEach(() => {
    window.localStorage.clear()
    list.mockResolvedValue(ANSWER)
    getDetail.mockImplementation(async (number) => detailAnswer(number))
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('links the customer’s name and the View button to their pages', async () => {
    renderPage()
    await screen.findByText('SI-1')

    expect(screen.getByRole('link', { name: 'Customer 1' })).toHaveAttribute(
      'href',
      '/sage/invoices/customer/ACC1',
    )
    expect(screen.getByRole('link', { name: 'View invoice SI-1' })).toHaveAttribute(
      'href',
      '/sage/invoices/SI-1?kind=invoice',
    )
  })

  it('opens the customer’s page — a full page with a tab of its own — and goes back', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('SI-1')

    await user.click(screen.getByRole('link', { name: 'Customer 1' }))

    expect(screen.getByTestId('path')).toHaveTextContent('/sage/invoices/customer/ACC1')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Customer 1' }),
    ).toBeVisible()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // The customer's invoices were asked for by their account reference.
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(expect.objectContaining({ account_ref: 'ACC1' })),
    )
    const strip = screen.getByRole('navigation', { name: 'Open invoices' })
    expect(
      within(strip).getByRole('button', { name: /^Customer\s*Customer 1$/ }),
    ).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /^Invoices/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to list' }))
    await waitFor(() =>
      expect(screen.getByTestId('path')).toHaveTextContent(/^\/sage\/invoices$/),
    )
  })

  it('opens the invoice’s page from View and asks the API for it by its number', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('SI-2')

    await user.click(screen.getByRole('link', { name: 'View invoice SI-2' }))

    expect(screen.getByTestId('path')).toHaveTextContent(
      '/sage/invoices/SI-2?kind=invoice',
    )
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Invoice SI-2' }),
    ).toBeVisible()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(getDetail).toHaveBeenCalledWith('SI-2'))

    const overview = (await screen.findByText('Invoice overview')).closest('section')
    expect(overview).toHaveTextContent('PO-SI-2')
    expect(screen.getByText('Customer information').closest('section')).toHaveTextContent(
      'buyer@example.com',
    )
    expect(screen.getByText('Invoice address').closest('section')).toHaveTextContent(
      '1 High St',
    )
    expect(screen.getByText('Delivery address').closest('section')).toHaveTextContent(
      'No delivery address.',
    )
    expect(screen.getByText('Amount summary').closest('section')).toHaveTextContent(
      '£30.00',
    )
    expect(screen.getByText('VAT analysis').closest('section')).toHaveTextContent(
      '£25.00',
    )
    expect(screen.getByText('Payment information').closest('section')).toHaveTextContent(
      'Part Paid',
    )
    expect(
      within(screen.getByRole('navigation', { name: 'Open invoices' })).getByRole(
        'button',
        {
          name: /^Invoice\s*SI-2$/,
        },
      ),
    ).toHaveAttribute('aria-current', 'page')
  })

  it('opens the same page from the invoice number', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('SI-1')

    await user.click(screen.getByRole('link', { name: 'SI-1' }))

    expect(screen.getByTestId('path')).toHaveTextContent(
      '/sage/invoices/SI-1?kind=invoice',
    )
    expect(await screen.findByText('Invoice overview')).toBeInTheDocument()
    expect(getDetail).toHaveBeenCalledWith('SI-1')
  })

  it('lists the lines, the payments and the extra information on their own tabs', async () => {
    const user = userEvent.setup()
    renderPage('/sage/invoices/SI-1?kind=invoice')
    await screen.findByText('Invoice overview')

    await user.click(screen.getByRole('tab', { name: /^Line items/ }))
    expect(screen.getByText('BAG-1')).toBeInTheDocument()
    expect(screen.getByText('Paper bag')).toBeInTheDocument()
    // A line with no stock code is a text line, shown as plain text.
    expect(screen.getByText('Free text note')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /^Payments/ }))
    expect(screen.getByText('PAY-7')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Additional information' }))
    expect(screen.getByText('Leave at the gate')).toBeInTheDocument()
  })

  it('shows a message and Try again when the invoice cannot be loaded', async () => {
    const user = userEvent.setup()
    // The hook asks once more after a failure, so it has to fail twice.
    getDetail
      .mockRejectedValueOnce(new ApiError('The server is down', { status: 500 }))
      .mockRejectedValueOnce(new ApiError('The server is down', { status: 500 }))
    renderPage('/sage/invoices/SI-1?kind=invoice')

    expect(
      await screen.findByText('Couldn’t load this invoice', {}, { timeout: 4000 }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Invoice overview')).toBeInTheDocument()
  })

  it('says so when an address names an invoice that does not exist', async () => {
    getDetail.mockRejectedValue(new ApiError('Not Found', { status: 404 }))
    renderPage('/sage/invoices/NOPE-9')

    expect(await screen.findByText('Invoice not found')).toBeInTheDocument()
  })
})
