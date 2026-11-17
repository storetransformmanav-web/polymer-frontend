import { describe, expect, it } from 'vitest'
import {
  DEFAULT_INVOICE_FILTERS,
  hasActiveInvoiceFilters,
  toInvoiceParams,
  type InvoiceFilters,
} from './useInvoices.ts'

const filters = (changes: Partial<InvoiceFilters> = {}): InvoiceFilters => ({
  ...DEFAULT_INVOICE_FILTERS,
  ...changes,
})

describe('toInvoiceParams — the filters as the API takes them', () => {
  it('sends only paging and sorting when nothing is filtered', () => {
    // The API's own default view: `?kind=all&sort=number&order=desc&page=1&page_size=25`.
    expect(toInvoiceParams(filters())).toEqual({
      kind: 'all',
      page: 1,
      page_size: 25,
      sort: 'number',
      order: 'desc',
    })
  })

  it('sends every filter under the API’s name', () => {
    expect(
      toInvoiceParams(
        filters({
          kind: 'credit_note',
          search: '  SI-100  ',
          accountRef: 'ACM001',
          paymentStatus: 'overdue',
          takenBy: 'Sam',
          from: '2026-10-01',
          to: '2026-10-31',
          minTotal: '100',
          maxTotal: '2500.50',
          sort: 'outstanding',
          order: 'asc',
          page: 3,
          pageSize: 50,
        }),
      ),
    ).toEqual({
      kind: 'credit_note',
      search: 'SI-100',
      account_ref: 'ACM001',
      payment_status: 'overdue',
      taken_by: 'Sam',
      date_from: '2026-10-01',
      date_to: '2026-10-31',
      min_total: '100',
      max_total: '2500.5',
      sort: 'outstanding',
      order: 'asc',
      page: 3,
      page_size: 50,
    })
  })

  it('leaves out blanks, and amounts that are not numbers or are negative', () => {
    const params = toInvoiceParams(
      filters({ search: '   ', takenBy: ' ', minTotal: 'abc', maxTotal: '-5' }),
    )
    expect(params).not.toHaveProperty('search')
    expect(params).not.toHaveProperty('taken_by')
    expect(params).not.toHaveProperty('min_total')
    expect(params).not.toHaveProperty('max_total')
  })

  it('never asks for more than 100 records a page', () => {
    expect(toInvoiceParams(filters({ pageSize: 500 })).page_size).toBe(100)
    expect(toInvoiceParams(filters({ pageSize: 0 })).page_size).toBe(1)
  })
})

describe('hasActiveInvoiceFilters', () => {
  it('is off for the default view and for a different sort or page size', () => {
    expect(hasActiveInvoiceFilters(filters())).toBe(false)
    expect(
      hasActiveInvoiceFilters(filters({ sort: 'total', order: 'asc', pageSize: 100 })),
    ).toBe(false)
  })

  it('is on as soon as any filter narrows the list', () => {
    expect(hasActiveInvoiceFilters(filters({ kind: 'invoice' }))).toBe(true)
    expect(hasActiveInvoiceFilters(filters({ search: 'x' }))).toBe(true)
    expect(hasActiveInvoiceFilters(filters({ accountRef: 'x' }))).toBe(true)
    expect(hasActiveInvoiceFilters(filters({ paymentStatus: 'paid' }))).toBe(true)
    expect(hasActiveInvoiceFilters(filters({ takenBy: 'x' }))).toBe(true)
    expect(hasActiveInvoiceFilters(filters({ from: '2026-01-01' }))).toBe(true)
    expect(hasActiveInvoiceFilters(filters({ to: '2026-01-01' }))).toBe(true)
    expect(hasActiveInvoiceFilters(filters({ minTotal: '1' }))).toBe(true)
    expect(hasActiveInvoiceFilters(filters({ maxTotal: '1' }))).toBe(true)
  })
})
