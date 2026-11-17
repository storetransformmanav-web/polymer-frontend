import { describe, expect, it } from 'vitest'
import { ApiError } from './ApiError.ts'
import { canonicalKey, readInvoice, readInvoiceList, toNumber } from './invoices.ts'

describe('toNumber and canonicalKey', () => {
  it('reads an amount from a number or from text', () => {
    expect(toNumber(12.5)).toBe(12.5)
    expect(toNumber('170.00')).toBe(170)
    expect(toNumber('£1,234.50')).toBe(1234.5)
    expect(toNumber('')).toBeNull()
    expect(toNumber('n/a')).toBeNull()
    expect(toNumber(null)).toBeNull()
    expect(toNumber(Number.NaN)).toBeNull()
  })

  it('writes a word the same way however the API spells it', () => {
    expect(canonicalKey('Part Paid')).toBe('part_paid')
    expect(canonicalKey('part-paid')).toBe('part_paid')
    expect(canonicalKey('NOT_POSTED')).toBe('not_posted')
    expect(canonicalKey(undefined)).toBe('')
  })
})

describe('readInvoice', () => {
  it('reads every field the page shows', () => {
    const invoice = readInvoice({
      id: 'inv-1',
      invoice_number: 'SI-100234',
      sales_order_number: 'SO-5',
      document_type: 'Credit Note',
      invoice_date: '2026-11-10',
      due_date: '2026-12-10',
      customer_name: 'Acme Ltd',
      customer_account_ref: 'ACM001',
      customer_order_number: 'PO-77',
      taken_by: 'Sam',
      net_amount: '100.00',
      tax_amount: 20,
      gross_amount: '120.00',
      paid_amount: '20.00',
      outstanding_amount: '100.00',
      payment_status: 'Part Paid',
      currency: 'GBP',
    })

    expect(invoice).toEqual({
      id: 'inv-1',
      number: 'SI-100234',
      salesOrderNumber: 'SO-5',
      kind: 'credit_note',
      date: '2026-11-10',
      dueDate: '2026-12-10',
      customerName: 'Acme Ltd',
      accountRef: 'ACM001',
      customerOrderNumber: 'PO-77',
      takenBy: 'Sam',
      net: 100,
      tax: 20,
      gross: 120,
      paid: 20,
      outstanding: 100,
      paymentStatus: 'part_paid',
      currency: 'GBP',
    })
  })

  it('also reads shorter names and a customer sent as one object', () => {
    const invoice = readInvoice({
      number: 'SI-9',
      kind: 'invoice',
      date: '2026-01-02',
      customer: { name: 'Beta plc', account_ref: 'BET002' },
      net: '10',
      tax: '2',
      total: '12',
      paid: '12',
      outstanding: '0',
      status: 'paid',
    })
    expect(invoice.customerName).toBe('Beta plc')
    expect(invoice.accountRef).toBe('BET002')
    expect(invoice.gross).toBe(12)
    expect(invoice.outstanding).toBe(0)
    expect(invoice.paymentStatus).toBe('paid')
    expect(invoice.id).toBe('invoice-SI-9')
  })

  it('leaves what is missing empty instead of failing', () => {
    const invoice = readInvoice({ invoice_number: 'SI-1' })
    expect(invoice.net).toBeNull()
    expect(invoice.dueDate).toBeNull()
    expect(invoice.customerName).toBe('')
    expect(invoice.paymentStatus).toBe('')
  })
})

describe('readInvoiceList', () => {
  const ITEM = { invoice_number: 'SI-1', gross_amount: '5' }

  it('reads items, totals, kind counts and the paging', () => {
    const answer = readInvoiceList({
      items: [ITEM],
      totals: {
        invoices: 1240,
        net_amount: '1000.00',
        tax_amount: '200.00',
        gross_amount: '1200.00',
        paid_amount: '700.00',
        outstanding_amount: '500.00',
        overdue_invoices: 12,
      },
      kind_counts: { invoice: 1200, credit_note: 40 },
      page: 2,
      page_size: 25,
      total: 1240,
      total_pages: 50,
      has_next: true,
    })

    expect(answer.items).toHaveLength(1)
    expect(answer.totals).toEqual({
      invoices: 1240,
      net: 1000,
      tax: 200,
      gross: 1200,
      paid: 700,
      outstanding: 500,
      overdue: 12,
    })
    expect(answer.kindCounts).toEqual([
      { kind: 'invoice', count: 1200 },
      { kind: 'credit_note', count: 40 },
    ])
    expect(answer).toMatchObject({
      page: 2,
      pageSize: 25,
      total: 1240,
      totalPages: 50,
      hasNext: true,
    })
  })

  it('reads kind counts sent as a list, and paging sent in its own block', () => {
    const answer = readInvoiceList({
      items: [ITEM],
      kind_counts: [
        { kind: 'Invoice', count: 3 },
        { document_type: 'Proforma', count: '2' },
      ],
      pagination: { page: 1, page_size: 10, total: 5, total_pages: 1 },
    })
    expect(answer.kindCounts).toEqual([
      { kind: 'invoice', count: 3 },
      { kind: 'proforma', count: 2 },
    ])
    expect(answer).toMatchObject({ page: 1, pageSize: 10, total: 5, totalPages: 1 })
    expect(answer.hasNext).toBe(false)
  })

  it('works out what the answer leaves out', () => {
    const answer = readInvoiceList({
      items: [ITEM, ITEM, ITEM],
      totals: { invoices: 60 },
    })
    expect(answer.totals?.invoices).toBe(60)
    expect(answer.total).toBe(60)
    expect(answer.page).toBe(1)
    expect(answer.kindCounts).toEqual([])
    expect(answer.totalPages).toBeGreaterThanOrEqual(1)
  })

  it('has no totals when the answer sends none', () => {
    expect(readInvoiceList({ items: [] }).totals).toBeNull()
  })

  it('refuses an answer with no list in it, with a readable message', () => {
    expect(() => readInvoiceList({ message: 'hi' })).toThrow(ApiError)
    expect(() => readInvoiceList('nope')).toThrow(/not in the expected form/)
  })
})
