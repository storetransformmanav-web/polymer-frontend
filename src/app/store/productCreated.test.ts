import { describe, expect, it } from 'vitest'
import type { ProductListItem, ProductListResponse } from '../../lib/api/endpoints.ts'
import {
  cacheKey,
  DEFAULT_FILTERS,
  fetchProducts,
  filtersChanged,
  productCreated,
  statusCountFilters,
  type ProductFilters,
} from './productsSlice.ts'
import { createAppStore } from './store.ts'

function item(id: string, overrides: Partial<ProductListItem> = {}): ProductListItem {
  return {
    shop: {
      key: 'polymer-uk',
      name: 'Polymer UK',
      domain: 'uk.myshopify.com',
      currency: 'GBP',
    },
    id,
    shopify_id: 1,
    title: id,
    handle: id,
    status: 'ACTIVE',
    vendor: null,
    product_type: null,
    category_name: null,
    tags: [],
    image_url: null,
    price_min: '1.00',
    price_max: '1.00',
    currency: 'GBP',
    variants_count: 1,
    total_inventory: null,
    shopify_created_at: null,
    shopify_updated_at: null,
    synced_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function page(
  items: ProductListItem[],
  total = items.length,
  pageSize = 25,
): ProductListResponse {
  return {
    items,
    page: 1,
    page_size: pageSize,
    total,
    total_pages: Math.max(1, Math.ceil(total / pageSize)),
    has_next: false,
    sort: 'created_at',
    order: 'desc',
  }
}

/** A store whose cache holds one list page (for the current filters) and the five status counts. */
function setup(
  items: ProductListItem[],
  filters: Partial<ProductFilters> = {},
  total = items.length,
) {
  const store = createAppStore()
  store.dispatch(filtersChanged(filters))
  const current = store.getState().products.filters
  store.dispatch(
    fetchProducts.fulfilled(
      { data: page(items, total, current.pageSize), fetchedAt: Date.now() },
      'r0',
      {
        filters: current,
      },
    ),
  )
  for (const [index, status] of (
    ['', 'ACTIVE', 'DRAFT', 'ARCHIVED'] as const
  ).entries()) {
    const counted = statusCountFilters(current, status)
    store.dispatch(
      fetchProducts.fulfilled(
        { data: page([items[0]], status === 'DRAFT' ? 4 : 10, 1), fetchedAt: Date.now() },
        `c${index}`,
        {
          filters: counted,
        },
      ),
    )
  }
  const state = () => store.getState().products
  const rows = () => state().entries[cacheKey(state().filters)]?.data
  const count = (status: '' | 'ACTIVE' | 'DRAFT' | 'ARCHIVED') =>
    state().entries[cacheKey(statusCountFilters(state().filters, status))]?.data?.total
  return { store, state, rows, count }
}

describe('productCreated', () => {
  it('puts the new product at the top of the page being shown, and counts it', () => {
    const { store, rows } = setup([item('a'), item('b')])
    store.dispatch(productCreated(item('new', { status: 'DRAFT' })))

    expect(rows()?.items.map((row) => row.id)).toEqual(['new', 'a', 'b'])
    expect(rows()?.total).toBe(3)
  })

  it('is also what the list shows while the next page loads (lastData)', () => {
    const { store, state } = setup([item('a')])
    store.dispatch(productCreated(item('new')))

    expect(state().lastData?.items[0].id).toBe('new')
  })

  it('keeps the page the size it is — the last row moves to the next page', () => {
    const { store, rows } = setup([item('a'), item('b')], { pageSize: 2 })
    store.dispatch(productCreated(item('new')))

    expect(rows()?.items.map((row) => row.id)).toEqual(['new', 'a'])
    expect(rows()?.total).toBe(3)
  })

  it('does not show the same product twice', () => {
    const { store, rows } = setup([item('a'), item('new')])
    store.dispatch(productCreated(item('new')))

    expect(rows()?.items.map((row) => row.id)).toEqual(['new', 'a'])
  })

  it('grows the status tab counts: All and its own status, but not the others', () => {
    const { store, count } = setup([item('a')])
    store.dispatch(productCreated(item('new', { status: 'DRAFT' })))

    expect(count('')).toBe(11)
    expect(count('DRAFT')).toBe(5)
    expect(count('ACTIVE')).toBe(10)
    expect(count('ARCHIVED')).toBe(10)
  })

  it('leaves a list alone that the product would not appear in, but still counts it', () => {
    // Showing only Active products, and the new one is a draft.
    const { store, rows, count } = setup([item('a')], { status: 'ACTIVE' })
    store.dispatch(productCreated(item('new', { status: 'DRAFT' })))

    expect(rows()?.items.map((row) => row.id)).toEqual(['a'])
    expect(count('DRAFT')).toBe(5)
  })

  it('leaves a searched, filtered, later or differently sorted page for the refetch', () => {
    for (const filters of [
      { search: 'bag' },
      { productType: 'Bags' },
      { tag: 'eco' },
      { page: 2 },
      { sort: 'title' as const },
      { order: 'asc' as const },
    ]) {
      const { store, rows } = setup([item('a')], filters)
      store.dispatch(productCreated(item('new')))
      expect(rows()?.items.map((row) => row.id)).toEqual(['a'])
    }
  })

  it('only counts it for the store it was created in', () => {
    const { store, count } = setup([item('a')], { shop: 'polymer-eu' })
    store.dispatch(productCreated(item('new', { status: 'DRAFT' })))

    // The tabs show polymer-eu, the product went to polymer-uk.
    expect(count('')).toBe(10)
  })

  it('marks every cached query stale, so each is re-read quietly', () => {
    const { store, state } = setup([item('a')])
    store.dispatch(productCreated(item('new')))

    for (const entry of Object.values(state().entries)) expect(entry.fetchedAt).toBeNull()
  })

  it('adds its type and tags to the filter choices', () => {
    const { store, state } = setup([item('a')])
    store.dispatch(productCreated(item('new', { product_type: 'Trays', tags: ['eco'] })))

    expect(state().facets.productTypes).toContain('Trays')
    expect(state().facets.tags).toContain('eco')
  })

  it('works from the default filters', () => {
    expect(DEFAULT_FILTERS.sort).toBe('created_at')
    expect(DEFAULT_FILTERS.order).toBe('desc')
  })
})
