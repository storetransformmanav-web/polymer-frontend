import { describe, expect, it } from 'vitest'
import type { OrderListResponse } from '../../lib/api/endpoints.ts'
import { sessionCleared } from './authSlice.ts'
import {
  DEFAULT_ORDER_FILTERS,
  fetchOrders,
  fulfillmentCountFilters,
  hasActiveOrderFilters,
  orderFiltersChanged,
  orderFiltersReset,
  ordersCacheKey,
  ordersReducer,
  toOrderParams,
  type OrderFilters,
} from './ordersSlice.ts'
import { ALL_SHOPS, shopSelected } from './shopSlice.ts'

const filters = (over: Partial<OrderFilters> = {}): OrderFilters => ({
  ...DEFAULT_ORDER_FILTERS,
  ...over,
})

describe('toOrderParams', () => {
  it('sends only sort, order and paging for the default filters', () => {
    expect(toOrderParams(filters())).toEqual({
      sort: 'created_at',
      order: 'desc',
      page: 1,
      page_size: 25,
    })
  })

  it('maps every filter to the API’s own parameter name', () => {
    const params = toOrderParams(
      filters({
        search: '  #1001  ',
        shop: 'polymer-uk',
        financial: 'PAID',
        fulfillment: 'UNFULFILLED',
        source: 'draft_order',
        gateway: 'shopify_payments',
        tag: 'b2b',
        cancelled: 'no',
        minTotal: '100',
        maxTotal: '1000.50',
        sort: 'total',
        order: 'asc',
        page: 3,
        pageSize: 50,
      }),
    )

    expect(params).toEqual({
      search: '#1001',
      shop: 'polymer-uk',
      financial_status: 'PAID',
      fulfillment_status: 'UNFULFILLED',
      source: 'draft_order',
      gateway: 'shopify_payments',
      tag: 'b2b',
      cancelled: false,
      min_total: 100,
      max_total: 1000.5,
      sort: 'total',
      order: 'asc',
      page: 3,
      page_size: 50,
    })
  })

  it('sends cancelled=true for "yes", and leaves it out for "any"', () => {
    expect(toOrderParams(filters({ cancelled: 'yes' })).cancelled).toBe(true)
    expect('cancelled' in toOrderParams(filters({ cancelled: '' }))).toBe(false)
  })

  it('ignores a total that is not a number or is negative', () => {
    const params = toOrderParams(filters({ minTotal: 'abc', maxTotal: '-5' }))
    expect('min_total' in params).toBe(false)
    expect('max_total' in params).toBe(false)
  })

  it('turns whole days into the first and last second of those days (local time)', () => {
    const params = toOrderParams(filters({ from: '2026-10-01', to: '2026-10-22' }))

    expect(new Date(params.from!).getTime()).toBe(
      new Date('2026-10-01T00:00:00').getTime(),
    )
    expect(new Date(params.to!).getTime()).toBe(new Date('2026-10-22T23:59:59').getTime())
    // They are ISO timestamps.
    expect(params.from).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('sends only one end of the range when only one is set', () => {
    expect('to' in toOrderParams(filters({ from: '2026-10-01' }))).toBe(false)
    expect('from' in toOrderParams(filters({ to: '2026-10-22' }))).toBe(false)
  })
})

describe('cache keys and tab counts', () => {
  it('gives two filter sets that make the same request the same key', () => {
    expect(ordersCacheKey(filters({ search: '  a ' }))).toBe(
      ordersCacheKey(filters({ search: 'a' })),
    )
    expect(ordersCacheKey(filters())).not.toBe(ordersCacheKey(filters({ page: 2 })))
  })

  it('counts a tab with the other filters, one row, and the default sort', () => {
    const counted = fulfillmentCountFilters(
      filters({ search: 'x', financial: 'PAID', sort: 'total', order: 'asc', page: 4 }),
      'ON_HOLD',
    )

    expect(counted).toMatchObject({
      search: 'x',
      financial: 'PAID',
      fulfillment: 'ON_HOLD',
      page: 1,
      pageSize: 1,
      sort: 'created_at',
      order: 'desc',
    })
  })

  it('knows when a narrowing filter is set (not sort, paging or the store)', () => {
    expect(hasActiveOrderFilters(filters())).toBe(false)
    expect(
      hasActiveOrderFilters(filters({ sort: 'total', page: 3, shop: 'polymer-uk' })),
    ).toBe(false)
    for (const change of [
      { search: 'a' },
      { financial: 'PAID' },
      { fulfillment: 'FULFILLED' },
      { source: 'web' },
      { gateway: 'paypal' },
      { tag: 'b2b' },
      { cancelled: 'yes' },
      { minTotal: '1' },
      { maxTotal: '1' },
      { from: '2026-10-01' },
      { to: '2026-10-01' },
    ] as Partial<OrderFilters>[]) {
      expect(hasActiveOrderFilters(filters(change)), JSON.stringify(change)).toBe(true)
    }
  })
})

describe('the orders reducer', () => {
  const state = (...actions: Parameters<typeof ordersReducer>[1][]) =>
    actions.reduce(
      ordersReducer,
      undefined as unknown as ReturnType<typeof ordersReducer>,
    )

  const RESPONSE: OrderListResponse = {
    items: [],
    totals: null,
    page: 1,
    page_size: 25,
    total: 0,
    total_pages: 1,
    has_next: false,
    sort: 'created_at',
    order: 'desc',
  }

  it('goes back to page 1 on any change but a page change', () => {
    const paged = state(orderFiltersChanged({ page: 4 }))
    expect(paged.filters.page).toBe(4)

    expect(
      ordersReducer(paged, orderFiltersChanged({ source: 'web' })).filters,
    ).toMatchObject({
      source: 'web',
      page: 1,
    })
    expect(ordersReducer(paged, orderFiltersChanged({ page: 5 })).filters.page).toBe(5)
  })

  it('clears the narrowing filters but keeps sort, page size and the store', () => {
    const changed = state(
      orderFiltersChanged({
        search: 'a',
        financial: 'PAID',
        sort: 'total',
        pageSize: 50,
      }),
      shopSelected('polymer-uk'),
    )

    expect(ordersReducer(changed, orderFiltersReset()).filters).toEqual({
      ...DEFAULT_ORDER_FILTERS,
      sort: 'total',
      pageSize: 50,
      shop: 'polymer-uk',
    })
  })

  it('follows the store picked in the top bar, from page 1; "all shops" clears it', () => {
    const picked = state(orderFiltersChanged({ page: 3 }), shopSelected('polymer-uk'))
    expect(picked.filters).toMatchObject({ shop: 'polymer-uk', page: 1 })

    expect(ordersReducer(picked, shopSelected(ALL_SHOPS)).filters.shop).toBe('')
  })

  it('shows a cached page at once when its filters are chosen', () => {
    const f = filters({ source: 'web' })
    const cached: OrderListResponse = { ...RESPONSE, total: 7 }
    const withEntry = ordersReducer(
      state(orderFiltersChanged({ source: 'pos' })),
      fetchOrders.fulfilled({ data: cached, fetchedAt: 1 }, 'id', { filters: f }),
    )

    // Choosing the filters of that cached entry shows it in the same render.
    const next = ordersReducer(withEntry, orderFiltersChanged({ source: 'web' }))
    expect(next.lastData?.total).toBe(7)
  })

  it('collects the tags and payment gateways it sees, sorted', () => {
    const data: OrderListResponse = {
      ...RESPONSE,
      items: [
        { tags: ['b2b', 'Expected'], payment_gateway_names: ['manual'] },
        { tags: ['b2b'], payment_gateway_names: ['shopify_payments', 'manual'] },
      ] as unknown as OrderListResponse['items'],
    }
    const next = ordersReducer(
      state(),
      fetchOrders.fulfilled({ data, fetchedAt: 1 }, 'id', { filters: filters() }),
    )

    expect(next.facets).toEqual({
      tags: ['b2b', 'Expected'],
      gateways: ['manual', 'shopify_payments'],
    })
  })

  it('keeps the old rows and sets an error when a re-read fails', () => {
    const f = filters()
    let current = ordersReducer(
      state(),
      fetchOrders.fulfilled({ data: { ...RESPONSE, total: 9 }, fetchedAt: 1 }, 'id', {
        filters: f,
      }),
    )
    current = ordersReducer(
      current,
      fetchOrders.rejected(null, 'id', { filters: f }, 'Server busy'),
    )

    const entry = current.entries[ordersCacheKey(f)]
    expect(entry.data?.total).toBe(9)
    expect(entry.error).toBe('Server busy')
    expect(entry.isFetching).toBe(false)
  })

  it('drops everything when the session ends', () => {
    const f = filters()
    const loaded = ordersReducer(
      state(),
      fetchOrders.fulfilled({ data: RESPONSE, fetchedAt: 1 }, 'id', { filters: f }),
    )

    const cleared = ordersReducer(loaded, sessionCleared())
    expect(cleared.entries).toEqual({})
    expect(cleared.lastData).toBeNull()
  })
})
