import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, type ProductFilters } from '../../../app/store/productsSlice.ts'
import type { ProductListItem } from '../../../lib/api/endpoints.ts'
import {
  buildExportParams,
  csvFile,
  exportFilename,
  hasExportableFilters,
  hasUnsupportedFilters,
} from './exportRequest.ts'

const item = (over: Partial<ProductListItem> = {}): ProductListItem => ({
  shop: {
    key: 'polymer-uk',
    name: 'Polymer UK',
    domain: 'polymer-uk-ltd.myshopify.com',
    currency: 'GBP',
  },
  id: 'id-1',
  shopify_id: 111,
  title: 'Hippo Bag',
  handle: 'hippo-bag',
  status: 'ACTIVE',
  vendor: 'Polymer',
  product_type: 'Bags',
  category_name: null,
  tags: [],
  image_url: null,
  price_min: '25.85',
  price_max: '30.00',
  currency: 'GBP',
  variants_count: 1,
  total_inventory: 7,
  shopify_created_at: null,
  shopify_updated_at: null,
  synced_at: '2026-01-01T00:00:00Z',
  ...over,
})

const filters = (over: Partial<ProductFilters> = {}): ProductFilters => ({
  ...DEFAULT_FILTERS,
  ...over,
})

const page = [item(), item({ id: 'id-2', shopify_id: 222, handle: 'other' })]

describe('buildExportParams', () => {
  it('sends the Shopify ids of the page, and metafields', () => {
    expect(
      buildExportParams('page', { items: page, selected: [], filters: filters() }, true),
    ).toEqual({ ids: '111,222', metafields: true })
  })

  it('sends the ticked products only', () => {
    expect(
      buildExportParams(
        'selected',
        { items: page, selected: [page[1]], filters: filters() },
        false,
      ),
    ).toEqual({ ids: '222', metafields: false })
  })

  it('sends only the store for "all products"', () => {
    expect(
      buildExportParams(
        'all',
        {
          items: page,
          selected: [],
          filters: filters({ search: 'bag', shop: 'polymer-uk' }),
        },
        true,
      ),
    ).toEqual({ metafields: true, shop: 'polymer-uk' })
  })

  it('sends the search and filters for "matching", status in lower case', () => {
    expect(
      buildExportParams(
        'matching',
        {
          items: page,
          selected: [],
          filters: filters({
            search: '  bag ',
            status: 'ACTIVE',
            productType: 'Bags',
            tag: 'new',
            shop: 'polymer-uk',
            sort: 'title',
            page: 3,
          }),
        },
        true,
      ),
    ).toEqual({
      metafields: true,
      shop: 'polymer-uk',
      search: 'bag',
      status: 'active',
      product_type: 'Bags',
      tag: 'new',
    })
  })
})

describe('filters the export understands', () => {
  it('knows search, status, type and tag', () => {
    expect(hasExportableFilters(filters())).toBe(false)
    expect(hasExportableFilters(filters({ search: 'x' }))).toBe(true)
    expect(hasExportableFilters(filters({ tag: 'x' }))).toBe(true)
  })

  it('knows stock and price have no export parameter', () => {
    expect(hasUnsupportedFilters(filters())).toBe(false)
    expect(hasUnsupportedFilters(filters({ stock: 'in' }))).toBe(true)
    expect(hasUnsupportedFilters(filters({ minPrice: '5' }))).toBe(true)
  })
})

describe('the file', () => {
  it('is named like the backend names its own', () => {
    const now = new Date(2026, 9, 27, 12, 40)
    expect(exportFilename(undefined, now)).toBe(
      'products_export_all-stores_20261027-1240.csv',
    )
    expect(exportFilename('polymer-uk', now)).toBe(
      'products_export_polymer-uk_20261027-1240.csv',
    )
  })

  it('gets one byte-order mark for Excel, none when plain', async () => {
    // Bytes, not `.text()`, which drops a leading mark when it decodes.
    const bytes = async (blob: Blob) => [...new Uint8Array(await blob.arrayBuffer())]
    const BOM = [0xef, 0xbb, 0xbf]
    const A_B = [0x61, 0x2c, 0x62]

    const excel = await bytes(csvFile('Handle,Café', 'excel'))
    expect(excel.slice(0, 3)).toEqual(BOM)
    expect(excel.slice(3)).toEqual([...new TextEncoder().encode('Handle,Café')])
    // A file that already has one is not given a second.
    expect(await bytes(csvFile('﻿a,b', 'excel'))).toEqual([...BOM, ...A_B])
    expect(await bytes(csvFile('a,b', 'plain'))).toEqual(A_B)
    expect(csvFile('a', 'plain').type).toBe('text/csv;charset=utf-8')
  })
})
