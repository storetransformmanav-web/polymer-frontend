import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CUSTOMER_FILTERS,
  type CustomerFilters,
} from '../../../app/store/customersSlice.ts'
import type { CustomerListItem } from '../../../lib/api/endpoints.ts'
import {
  buildCustomerExportParams,
  customerExportFilename,
  hasExportableFilters,
} from './exportRequest.ts'

const filters = (patch: Partial<CustomerFilters> = {}): CustomerFilters => ({
  ...DEFAULT_CUSTOMER_FILTERS,
  ...patch,
})
const row = (id: string) => ({ id }) as CustomerListItem

describe('buildCustomerExportParams', () => {
  it('all customers: every role, and only the store', () => {
    const narrowed = filters({ search: 'jane', marketing: 'yes', shop: 'polymer-uk' })
    expect(buildCustomerExportParams('all', [], narrowed)).toEqual({
      role: 'all',
      shop: 'polymer-uk',
    })
    expect(buildCustomerExportParams('all', [], filters())).toEqual({ role: 'all' })
  })

  it('current page: the rows by id', () => {
    expect(buildCustomerExportParams('page', [row('a'), row('b')], filters())).toEqual({
      role: 'all',
      ids: 'a,b',
    })
  })

  it('matching: the list’s own filters, without its paging or order', () => {
    const params = buildCustomerExportParams(
      'matching',
      [],
      filters({
        search: ' jane ',
        role: 'subscriber',
        marketing: 'no',
        orders: 'yes',
        shop: 'polymer-uk',
        page: 4,
      }),
    )
    expect(params).toEqual({
      search: 'jane',
      role: 'subscriber',
      accepts_marketing: false,
      has_orders: true,
      shop: 'polymer-uk',
    })
    expect(params).not.toHaveProperty('page', expect.anything())
  })
})

describe('hasExportableFilters', () => {
  it('is about the search and the filters, not the store or the page', () => {
    expect(hasExportableFilters(filters())).toBe(false)
    expect(hasExportableFilters(filters({ shop: 'polymer-uk', page: 3 }))).toBe(false)
    expect(hasExportableFilters(filters({ search: 'jane' }))).toBe(true)
    expect(hasExportableFilters(filters({ role: 'administrator' }))).toBe(true)
  })
})

describe('customerExportFilename', () => {
  it('names the store and the time', () => {
    const now = new Date(2026, 10, 5, 9, 7)
    expect(customerExportFilename(undefined, now)).toBe(
      'customers_export_all-stores_20261105-0907.csv',
    )
    expect(customerExportFilename('polymer-uk', now)).toBe(
      'customers_export_polymer-uk_20261105-0907.csv',
    )
  })
})
