import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ORDER_FILTERS,
  type OrderFilters,
} from '../../../app/store/ordersSlice.ts'
import type { OrderListItem } from '../../../lib/api/endpoints.ts'
import { buildOrderExportParams, orderExportFilename } from './exportRequest.ts'

const filters = (patch: Partial<OrderFilters> = {}): OrderFilters => ({
  ...DEFAULT_ORDER_FILTERS,
  ...patch,
})
const row = (id: string) => ({ id }) as OrderListItem

describe('buildOrderExportParams', () => {
  it('all orders: only the store, whatever the list is narrowed to', () => {
    const narrowed = filters({ search: '17002', financial: 'PAID', shop: 'polymer-uk' })
    expect(buildOrderExportParams('all', [], narrowed)).toEqual({ shop: 'polymer-uk' })
    expect(buildOrderExportParams('all', [], filters({ shop: '' }))).toEqual({})
  })

  it('current page: the rows by id', () => {
    expect(
      buildOrderExportParams('page', [row('a'), row('b')], filters({ shop: '' })),
    ).toEqual({ ids: 'a,b' })
    expect(
      buildOrderExportParams('page', [row('a')], filters({ shop: 'polymer-uk' })),
    ).toEqual({ shop: 'polymer-uk', ids: 'a' })
  })

  it('matching: the list’s own question, without its paging or order', () => {
    const params = buildOrderExportParams(
      'matching',
      [],
      filters({
        search: ' 17002 ',
        financial: 'PAID',
        fulfillment: 'UNFULFILLED',
        source: 'web',
        tag: 'vip',
        cancelled: 'no',
        minTotal: '10',
        maxTotal: '500',
        from: '2026-10-01',
        to: '2026-10-31',
        shop: 'polymer-uk',
        page: 4,
        pageSize: 50,
        sort: 'total',
        order: 'asc',
      }),
    )
    expect(params).toMatchObject({
      search: '17002',
      financial_status: 'PAID',
      fulfillment_status: 'UNFULFILLED',
      source: 'web',
      tag: 'vip',
      cancelled: false,
      min_total: 10,
      max_total: 500,
      shop: 'polymer-uk',
    })
    expect(params.from).toEqual(expect.any(String))
    expect(params.to).toEqual(expect.any(String))
    for (const key of ['page', 'page_size', 'sort', 'order']) {
      expect(params).not.toHaveProperty(key)
    }
  })
})

describe('orderExportFilename', () => {
  it('names the store and the time', () => {
    const now = new Date(2026, 10, 5, 9, 7)
    expect(orderExportFilename(undefined, now)).toBe(
      'orders_export_all-stores_20261105-0907.csv',
    )
    expect(orderExportFilename('polymer-uk', now)).toBe(
      'orders_export_polymer-uk_20261105-0907.csv',
    )
  })
})
