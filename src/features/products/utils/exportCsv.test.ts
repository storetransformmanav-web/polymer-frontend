import { describe, expect, it } from 'vitest'
import type { ProductListItem } from '../../../lib/api/endpoints.ts'
import { EXPORT_COLUMNS, pickColumns } from './exportColumns.ts'
import { buildProductsCsv, csvCell } from './exportCsv.ts'

const SHOP = {
  key: 'polymer-uk',
  name: 'Polymer UK',
  domain: 'polymer-uk-ltd.myshopify.com',
  currency: 'GBP',
}

const item = (over: Partial<ProductListItem> = {}): ProductListItem => ({
  shop: SHOP,
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

describe('csvCell', () => {
  it('writes plain text and numbers as they are, and nothing for a missing value', () => {
    expect(csvCell('Hippo Bag')).toBe('Hippo Bag')
    expect(csvCell(7)).toBe('7')
    expect(csvCell(-3)).toBe('-3')
    expect(csvCell(0)).toBe('0')
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
    expect(csvCell('')).toBe('')
    expect(csvCell(Number.NaN)).toBe('')
  })

  it('quotes text with a comma, a quote or a line break, doubling the quotes', () => {
    expect(csvCell('Bags, large')).toBe('"Bags, large"')
    expect(csvCell('The "Big" one')).toBe('"The ""Big"" one"')
    expect(csvCell('two\nlines')).toBe('"two\nlines"')
    expect(csvCell('two\r\nlines')).toBe('"two\r\nlines"')
    expect(csvCell(' padded ')).toBe('" padded "')
  })

  it('stops a spreadsheet running text as a formula', () => {
    expect(csvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)")
    expect(csvCell('+44 20 7946 0000')).toBe("'+44 20 7946 0000")
    expect(csvCell('-5% off')).toBe("'-5% off")
    expect(csvCell('@mention')).toBe("'@mention")
    expect(csvCell('\tTabbed')).toBe("'\tTabbed")
    expect(csvCell('=HYPERLINK("http://evil","x")')).toBe(
      `"'=HYPERLINK(""http://evil"",""x"")"`,
    )
    // Only a *leading* character matters.
    expect(csvCell('a=b')).toBe('a=b')
  })
})

describe('buildProductsCsv', () => {
  it('has a header row with every column, then one row per product, in CRLF lines', () => {
    const csv = buildProductsCsv([item(), item({ id: 'id-2', title: 'Desk' })])
    const lines = csv.split('\r\n')

    expect(lines).toHaveLength(4) // header, 2 products, and the empty end after the last CRLF
    expect(lines[3]).toBe('')
    expect(lines[0].split(',')).toEqual(EXPORT_COLUMNS.map((c) => c.header))
    expect(lines[0]).toBe(
      'Product ID,Shopify ID,Title,Handle,Status,Vendor,Product type,Category,Tags,Store,Store key,Store domain,Price from,Price to,Currency,Variants,Inventory,Image URL,Shopify admin URL,Created (Shopify),Updated (Shopify),Last synced',
    )
  })

  it('writes every field of a product, with the status as the table shows it and a Shopify admin link', () => {
    const [, row] = buildProductsCsv([item()]).split('\r\n')

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

  it('leaves empty cells for what a product does not have', () => {
    const [, row] = buildProductsCsv([
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
    ]).split('\r\n')

    expect(row.split(',')).toHaveLength(EXPORT_COLUMNS.length)
    expect(row).toBe(
      'id-1,15393751269761,Hippo Bag,hippo-bag,,,,,,,,,,,,2,,,,,,2026-10-10T00:00:00Z',
    )
  })

  it('keeps a title with a comma, a quote or a formula in one safe cell', () => {
    const [, row] = buildProductsCsv([
      item({ title: '=cmd|"/c calc"!A1, "x"', vendor: 'A, B' }),
    ]).split('\r\n')

    expect(row).toContain(`"'=cmd|""/c calc""!A1, ""x"""`)
    expect(row).toContain('"A, B"')
  })

  it('is just the header for no products', () => {
    expect(buildProductsCsv([]).split('\r\n')).toHaveLength(2)
  })
})

describe('choosing columns', () => {
  it('writes only the chosen columns, in the file’s own order whatever order they were picked in', () => {
    const columns = pickColumns(['priceFrom', 'title', 'id'])
    const [header, row] = buildProductsCsv([item()], columns).split('\r\n')

    expect(header).toBe('Product ID,Title,Price from')
    expect(row).toBe('id-1,Hippo Bag,25.85')
  })

  it('has every column when none is narrowed down, and nothing but the header row for none', () => {
    expect(pickColumns(EXPORT_COLUMNS.map((c) => c.id))).toEqual(EXPORT_COLUMNS)
    expect(pickColumns([])).toEqual([])
  })

  it('has the Shopify ID as text, so a spreadsheet can never round a long id', () => {
    expect(EXPORT_COLUMNS.find((c) => c.id === 'shopifyId')?.kind).toBe('text')
    expect(EXPORT_COLUMNS.find((c) => c.id === 'variants')?.kind).toBe('integer')
    expect(EXPORT_COLUMNS.find((c) => c.id === 'priceFrom')?.kind).toBe('decimal')
  })
})
