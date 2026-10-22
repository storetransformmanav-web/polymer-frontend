import { describe, expect, it } from 'vitest'
import type { ProductListItem } from '../../../lib/api/endpoints.ts'
import { EXPORT_COLUMNS, pickColumns } from './exportColumns.ts'
import { buildProductsFile, exportFilename } from './exportFile.ts'

const item = (over: Partial<ProductListItem> = {}): ProductListItem => ({
  shop: {
    key: 'polymer-uk',
    name: 'Polymer UK',
    domain: 'polymer-uk-ltd.myshopify.com',
    currency: 'GBP',
  },
  id: 'id-1',
  shopify_id: 15393751269761,
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
  variants_count: 2,
  total_inventory: 7,
  shopify_created_at: null,
  shopify_updated_at: null,
  synced_at: '2026-10-10T00:00:00Z',
  ...over,
})

describe('exportFilename', () => {
  const date = new Date(2026, 9, 5, 14, 30)

  it('names a page export after its page, the local date and the format', () => {
    expect(exportFilename({ kind: 'page', page: 3 }, 'xlsx', date)).toBe(
      'products-page-3-2026-10-05.xlsx',
    )
    expect(exportFilename({ kind: 'page', page: 1 }, 'csv', date)).toBe(
      'products-page-1-2026-10-05.csv',
    )
  })

  it('names an export of everything after the date', () => {
    expect(exportFilename({ kind: 'all' }, 'xlsx', date)).toBe(
      'products-all-2026-10-05.xlsx',
    )
  })
})

describe('buildProductsFile', () => {
  it('makes a CSV (with a byte-order mark for Excel) of the chosen columns', async () => {
    const blob = buildProductsFile('csv', [item()], pickColumns(['title', 'status']))

    expect(blob.type).toBe('text/csv;charset=utf-8')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(await blob.text()).toContain('Title,Status\r\nHippo Bag,Active\r\n')
  })

  it('makes an Excel workbook (a ZIP file) with the right type', async () => {
    const blob = buildProductsFile('xlsx', [item()], EXPORT_COLUMNS)

    expect(blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    const bytes = new Uint8Array(await blob.arrayBuffer())
    // "PK\x03\x04": the start of a ZIP archive.
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
  })
})
