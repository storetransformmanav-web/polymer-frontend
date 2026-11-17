import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../../lib/api/endpoints.ts'
import type { Invoice, InvoiceListResponse } from '../../../lib/api/invoices.ts'
import { renderWithProviders } from '../../../test/renderWithProviders.tsx'
import { InvoicesPage } from './InvoicesPage.tsx'

vi.mock('../../../lib/api/endpoints.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api/endpoints.ts')>()),
  api: { invoices: { list: vi.fn() }, auth: {} },
}))

const list = vi.mocked(api.invoices.list)

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
  paid: 120,
  outstanding: 0,
  paymentStatus: 'paid',
  currency: 'GBP',
  ...changes,
})

function answer(changes: Partial<InvoiceListResponse> = {}): InvoiceListResponse {
  return {
    items: [
      invoice('1'),
      invoice('2', {
        paymentStatus: 'part_paid',
        paid: 20,
        outstanding: 100,
        kind: 'credit_note',
      }),
      invoice('3', { paymentStatus: 'overdue', paid: 0, outstanding: 120 }),
      invoice('4', { paymentStatus: 'unpaid', paid: 0, outstanding: 120 }),
      invoice('5', { paymentStatus: 'not_posted', paid: null, outstanding: null }),
    ],
    totals: {
      invoices: 1240,
      net: 100000,
      tax: 20000,
      gross: 120000,
      paid: 70000,
      outstanding: 50000,
      overdue: 12,
    },
    kindCounts: [
      { kind: 'invoice', count: 1200 },
      { kind: 'credit_note', count: 40 },
    ],
    page: 1,
    pageSize: 25,
    total: 1240,
    totalPages: 50,
    hasNext: true,
    ...changes,
  }
}

const lastParams = () => list.mock.calls[list.mock.calls.length - 1]?.[0]
const openFilters = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Filters' }))

describe('InvoicesPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    list.mockResolvedValue(answer())
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads the first page from the API with the default query', async () => {
    renderWithProviders(<InvoicesPage />)
    await screen.findByText('SI-1')

    expect(list).toHaveBeenCalledWith({
      kind: 'all',
      page: 1,
      page_size: 25,
      sort: 'number',
      order: 'desc',
    })
    expect(screen.getByText(/Showing/)).toHaveTextContent(
      'Showing 1 to 25 of 1,240 entries',
    )
  })

  it('shows the default columns, in this order, then Action', async () => {
    renderWithProviders(<InvoicesPage />)
    await screen.findByText('SI-1')
    const table = screen.getByRole('table')

    const headers = within(table)
      .getAllByRole('columnheader')
      .map((header) => header.textContent)
    expect(headers).toEqual([
      'Invoice Number',
      'Invoice Date',
      'Due Date',
      'Customer',
      'Net',
      'Tax',
      'Gross',
      'Payment Status',
      'Action',
    ])

    const row = within(table).getByRole('row', { name: /SI-1\b/ })
    for (const text of [
      '10 Nov 2026',
      '10 Dec 2026',
      'Customer 1',
      '£100.00',
      '£20.00',
      '£120.00',
    ]) {
      expect(within(row).getAllByText(text).length).toBeGreaterThan(0)
    }
  })

  it('draws a badge for each payment status, and Credit Note by its own name', async () => {
    renderWithProviders(<InvoicesPage />)
    await screen.findByText('SI-1')
    // The Invoice Type column is hidden to begin with: show it from the Columns menu.
    await userEvent.setup().click(screen.getByRole('button', { name: 'Columns' }))
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Show Invoice Type' }))
    const table = screen.getByRole('table')

    for (const status of ['Paid', 'Part Paid', 'Overdue', 'Unpaid', 'Not Posted']) {
      expect(within(table).getByText(status)).toBeInTheDocument()
    }
    expect(within(table).getByText('Credit Note')).toBeInTheDocument()
    const notPosted = within(table).getByRole('row', { name: /SI-5\b/ })
    expect(within(notPosted).getByText('Not Posted')).toBeInTheDocument()
  })

  it('shows the totals from the answer, and the document counts', async () => {
    renderWithProviders(<InvoicesPage />)
    await screen.findByText('SI-1')

    // The figures come before the table, so the first match is the card, not the column heading.
    const card = (label: string) =>
      screen.getAllByText(label)[0].closest('div')?.parentElement
    expect(card('Total Invoices')).toHaveTextContent('1,240')
    expect(card('Total Invoices')).toHaveTextContent('1,200 invoices · 40 credit notes')
    expect(card('Net Amount')).toHaveTextContent('£100,000.00')
    expect(card('Tax Amount')).toHaveTextContent('£20,000.00')
    expect(card('Gross Amount')).toHaveTextContent('£120,000.00')
    expect(card('Paid Amount')).toHaveTextContent('£70,000.00')
    expect(card('Outstanding Amount')).toHaveTextContent('£50,000.00')
    expect(card('Overdue Invoices')).toHaveTextContent('12')
  })

  it('searches through the API, after a pause, from page 1', async () => {
    const user = userEvent.setup()
    renderWithProviders(<InvoicesPage />)
    await screen.findByText('SI-1')

    await user.type(screen.getByRole('searchbox', { name: 'Search invoices' }), 'ACME')

    await waitFor(() => expect(lastParams()).toMatchObject({ search: 'ACME', page: 1 }), {
      timeout: 3000,
    })
    // Typing is not sent letter by letter.
    expect(
      list.mock.calls.filter(([params]) => params.search !== undefined),
    ).toHaveLength(1)
  })

  it('offers every document type with its count, and filters by the one chosen', async () => {
    const user = userEvent.setup()
    renderWithProviders(<InvoicesPage />)
    await screen.findByText('SI-1')
    await openFilters(user)

    const type = screen.getByRole('combobox', { name: 'Document type' })
    expect(
      within(type)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      'All Documents (1,240)',
      'Invoice (1,200)',
      'Credit Note (40)',
      'Quotation',
      'Proforma',
    ])

    await user.selectOptions(type, 'credit_note')
    await waitFor(() =>
      expect(lastParams()).toMatchObject({ kind: 'credit_note', page: 1 }),
    )
  })

  it('filters by payment status, account reference, taken by and the totals — all through the API', async () => {
    const user = userEvent.setup()
    renderWithProviders(<InvoicesPage />)
    await screen.findByText('SI-1')
    await openFilters(user)

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Payment status' }),
      'overdue',
    )
    await waitFor(() => expect(lastParams()).toMatchObject({ payment_status: 'overdue' }))

    await user.type(screen.getByLabelText('Customer account reference'), 'ACM001')
    await user.type(screen.getByLabelText('Taken by'), 'Sam')
    await user.type(screen.getByLabelText('Min total'), '100')
    await user.type(screen.getByLabelText('Max total'), '2500')

    await waitFor(
      () =>
        expect(lastParams()).toMatchObject({
          payment_status: 'overdue',
          account_ref: 'ACM001',
          taken_by: 'Sam',
          min_total: '100',
          max_total: '2500',
          page: 1,
        }),
      { timeout: 3000 },
    )
  })

  it('sorts by every sortable heading, and flips the direction on a second press', async () => {
    const user = userEvent.setup()
    renderWithProviders(<InvoicesPage />)
    await screen.findByText('SI-1')
    const table = screen.getByRole('table')

    const sortBy = (label: string) =>
      user.click(within(table).getByRole('button', { name: new RegExp(`^${label}`) }))
    const cases: [string, string][] = [
      ['Invoice Number', 'number'],
      ['Invoice Date', 'date'],
      ['Due Date', 'due_date'],
      ['Customer', 'customer'],
      ['Gross', 'total'],
    ]
    for (const [label, sort] of cases) {
      await sortBy(label)
      await waitFor(() => expect(lastParams()?.sort).toBe(sort))
    }

    // Gross was the last one: a second press reverses it.
    await waitFor(() =>
      expect(lastParams()).toMatchObject({ sort: 'total', order: 'asc' }),
    )
    await sortBy('Gross')
    await waitFor(() => expect(lastParams()).toMatchObject({ order: 'desc' }))
    expect(within(table).getByRole('columnheader', { name: /Gross/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    )
  })

  it('sorts from the Sort by and Order dropdowns too', async () => {
    const user = userEvent.setup()
    renderWithProviders(<InvoicesPage />)
    await screen.findByText('SI-1')
    await openFilters(user)

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Sort by' }),
      'due_date',
    )
    await user.selectOptions(screen.getByRole('combobox', { name: 'Order' }), 'asc')

    await waitFor(() =>
      expect(lastParams()).toMatchObject({ sort: 'due_date', order: 'asc' }),
    )
  })

  it('pages through the API: the next page, then a bigger page (100 at most)', async () => {
    const user = userEvent.setup()
    renderWithProviders(<InvoicesPage />)
    await screen.findByText('SI-1')

    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(lastParams()).toMatchObject({ page: 2, page_size: 25 }))

    const size = screen.getByRole('combobox', { name: 'Entries per page' })
    expect(
      within(size)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['10', '25', '50', '100'])
    await user.selectOptions(size, '100')
    await waitFor(() => expect(lastParams()).toMatchObject({ page: 1, page_size: 100 }))
  })

  it('Clear All puts the filters back and asks for the unfiltered list', async () => {
    const user = userEvent.setup()
    renderWithProviders(<InvoicesPage />)
    await screen.findByText('SI-1')
    expect(screen.getByRole('button', { name: 'Clear All' })).toBeDisabled()

    await openFilters(user)
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Payment status' }),
      'paid',
    )
    await waitFor(() => expect(lastParams()).toMatchObject({ payment_status: 'paid' }))

    await user.click(screen.getByRole('button', { name: 'Clear All' }))
    // Back to the unfiltered list (already known, so it shows at once): the filter is off again.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Clear All' })).toBeDisabled(),
    )
    expect(screen.getByRole('combobox', { name: 'Payment status' })).toHaveValue('')
  })

  it('says so, with Clear all filters, when nothing matches', async () => {
    const user = userEvent.setup()
    list.mockResolvedValue(
      answer({ items: [], total: 0, totalPages: 1, hasNext: false, kindCounts: [] }),
    )
    renderWithProviders(<InvoicesPage />)
    expect(await screen.findByText('No invoices found')).toBeInTheDocument()
    expect(screen.getByText('There are no invoices to show yet.')).toBeInTheDocument()

    await openFilters(user)
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Payment status' }),
      'paid',
    )
    expect(
      await screen.findByText('Nothing matches the current search and filters.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear all filters' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Clear All' })).toBeDisabled(),
    )
    expect(screen.getByText('There are no invoices to show yet.')).toBeInTheDocument()
  })

  it('shows the API’s error, and Try again asks again', async () => {
    const user = userEvent.setup()
    list.mockRejectedValueOnce(new Error('boom'))
    renderWithProviders(<InvoicesPage />)

    expect(await screen.findByText("Couldn't load invoices")).toBeInTheDocument()
    list.mockResolvedValue(answer())
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('SI-1')).toBeInTheDocument()
  })

  it('shows a loading state until the first answer arrives', async () => {
    list.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<InvoicesPage />)
    expect(await screen.findByRole('status')).toHaveTextContent('Loading invoices…')
    // The figures wait with dashes rather than inventing numbers.
    expect(
      screen.getByText('Total Invoices').closest('div')?.parentElement,
    ).toHaveTextContent('—')
  })
})
