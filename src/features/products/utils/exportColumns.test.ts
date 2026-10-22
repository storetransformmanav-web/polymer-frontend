import { describe, expect, it } from 'vitest'
import type { ProductListItem } from '../../../lib/api/endpoints.ts'
import { buildTableFile, pickColumns } from '../../../lib/tableExport.ts'
import { EXPORT_COLUMNS } from './exportColumns.ts'

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
  category_name: 'Luggage',
  tags: ['modern', 'new'],
  image_url: 'https://cdn.example.com/1.jpg',
  price_min: '25.85',
  price_max: '30.00',
  currency: 'GBP',
  variants_count: 2,
  total_inventory: 7,
  shopify_created_at: '2026-10-08T12:55:03Z',
  shopify_updated_at: '2026-10-09T08:00:00Z',
  synced_at: '2026-10-10T00:00:00Z',
  ...over,
})

const csv = async (items: ProductListItem[], columns = EXPORT_COLUMNS) =>
  (await buildTableFile('csv', items, columns, 'Products').text()).replace(/^﻿/, '')

describe('the products columns', () => {
  it('has a header row with every column, in order', async () => {
    const [header] = (await csv([item()])).split('\r\n')

    expect(header).toBe(
      'Product ID,Shopify ID,Title,Handle,Status,Vendor,Product type,Category,Tags,Store,Store key,Store domain,Price from,Price to,Currency,Variants,Inventory,Image URL,Shopify admin URL,Created (Shopify),Updated (Shopify),Last synced',
    )
    expect(EXPORT_COLUMNS).toHaveLength(22)
  })

  it('writes every field of a product, with the status as the table shows it and a Shopify admin link', async () => {
    const [, row] = (await csv([item()])).split('\r\n')

    expect(row).toBe(
      [
        'id-1',
        '15393751269761',
        'Hippo Bag',
        'hippo-bag',
        'Active',
        'Polymer',
        'Bags',
        'Luggage',
        '"modern, new"',
        'Polymer UK',
        'polymer-uk',
        'polymer-uk-ltd.myshopify.com',
        '25.85',
        '30.00',
        'GBP',
        '2',
        '7',
        'https://cdn.example.com/1.jpg',
        'https://admin.shopify.com/store/polymer-uk-ltd/products/15393751269761',
        '2026-10-08T12:55:03Z',
        '2026-10-09T08:00:00Z',
        '2026-10-10T00:00:00Z',
      ].join(','),
    )
  })

  it('leaves empty cells for what a product does not have', async () => {
    const [, row] = (
      await csv([
        item({
          shop: null,
          status: null,
          vendor: null,
          product_type: null,
          category_name: null,
          tags: [],
          image_url: null,
          price_min: null,
          price_max: null,
          currency: null,
          total_inventory: null,
          shopify_created_at: null,
          shopify_updated_at: null,
        }),
      ])
    ).split('\r\n')

    expect(row.split(',')).toHaveLength(EXPORT_COLUMNS.length)
    expect(row).toBe(
      'id-1,15393751269761,Hippo Bag,hippo-bag,,,,,,,,,,,,2,,,,,,2026-10-10T00:00:00Z',
    )
  })

  it('keeps a title with a comma, a quote or a formula in one safe cell', async () => {
    const [, row] = (
      await csv([item({ title: '=cmd|"/c calc"!A1, "x"', vendor: 'A, B' })])
    ).split('\r\n')

    expect(row).toContain(`"'=cmd|""/c calc""!A1, ""x"""`)
    expect(row).toContain('"A, B"')
  })

  it('writes only the chosen columns', async () => {
    const [header, row] = (
      await csv([item()], pickColumns(EXPORT_COLUMNS, ['priceFrom', 'title', 'id']))
    ).split('\r\n')

    expect(header).toBe('Product ID,Title,Price from')
    expect(row).toBe('id-1,Hippo Bag,25.85')
  })

  it('has the Shopify ID as text, so a spreadsheet can never round a long id', () => {
    const kind = (id: string) => EXPORT_COLUMNS.find((c) => c.id === id)?.kind
    expect(kind('shopifyId')).toBe('text')
    expect(kind('variants')).toBe('integer')
    expect(kind('priceFrom')).toBe('decimal')
  })
})
