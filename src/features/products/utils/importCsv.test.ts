import { describe, expect, it } from 'vitest'
import { buildCsv } from '../../../lib/csv.ts'
import { buildSampleImportCsv, summarizeImportCsv } from './importCsv.ts'

const HEADERS = [
  'Handle',
  'Title',
  'Body (HTML)',
  'Vendor',
  'Product Category',
  'Type',
  'Option1 Value',
  'Option2 Value',
  'Variant SKU',
  'Variant Grams',
  'Variant Price',
  'Image Src',
  'Status',
]
const row = (values: Record<string, string>) => HEADERS.map((name) => values[name] ?? '')

/** Two products: the first has four variants and pictures, the second has one variant. */
const TWO_PRODUCTS = buildCsv(HEADERS, [
  row({
    Handle: 'hippo-container',
    Title: 'Hippo Microwavable Container & Lid 123',
    'Body (HTML)':
      '<p>Hippo Microwavable <b>Container</b> &amp; Lid</p><script>x()</script>',
    Vendor: 'Packaging By Polymer',
    'Option1 Value': '500ml',
    'Variant SKU': 'MC01H',
    'Variant Grams': '9000',
    'Variant Price': '24.90',
    'Image Src': 'https://cdn.example.com/a.jpg',
    Status: 'active',
  }),
  row({
    Handle: 'hippo-container',
    'Option1 Value': '650ml',
    'Variant SKU': 'MC02H',
    'Variant Grams': '9000',
    'Variant Price': '25.50',
    'Image Src': 'https://cdn.example.com/b.jpg',
  }),
  // A picture-only row: it adds an image, not a variant.
  row({ Handle: 'hippo-container', 'Image Src': 'https://cdn.example.com/c.jpg' }),
  row({
    Handle: 'hippo-container',
    'Option1 Value': '750ml',
    'Option2 Value': 'Clear',
    'Variant SKU': 'MC03H',
    'Variant Price': '28.50',
  }),
  row({
    Handle: 'mop',
    Title: 'Mop',
    'Variant SKU': 'MOP1',
    'Variant Price': '5',
    'Image Src': 'https://cdn.example.com/a.jpg',
  }),
])

describe('summarizeImportCsv', () => {
  it('counts the products, the variants (rows with a SKU or price) and the pictures', () => {
    const result = summarizeImportCsv(TWO_PRODUCTS)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.summary).toMatchObject({ products: 2, variants: 4, images: 4 })
  })

  it('counts the same picture address once per product, not once overall', () => {
    const result = summarizeImportCsv(TWO_PRODUCTS)
    if (!result.ok) throw new Error('expected a summary')
    // a.jpg is on both products: three pictures on the first, one on the second.
    expect(result.summary.images).toBe(4)
  })

  it('shows the first product: its details as plain text, and its variants', () => {
    const result = summarizeImportCsv(TWO_PRODUCTS)
    if (!result.ok) throw new Error('expected a summary')

    expect(result.summary.first).toEqual({
      handle: 'hippo-container',
      title: 'Hippo Microwavable Container & Lid 123',
      // Text only — the script is gone, the markup is gone.
      description: expect.stringMatching(/^Hippo Microwavable Container & Lid\s*$/),
      status: 'Active',
      category: '',
      type: '',
      vendor: 'Packaging By Polymer',
      variants: [
        { label: '500ml', sku: 'MC01H', weight: '9000.00g', price: '24.90' },
        { label: '650ml', sku: 'MC02H', weight: '9000.00g', price: '25.50' },
        { label: '750ml / Clear', sku: 'MC03H', weight: '', price: '28.50' },
      ],
    })
  })

  it('calls a product without options "Default"', () => {
    const result = summarizeImportCsv(
      buildCsv(HEADERS, [row({ Handle: 'mop', Title: 'Mop', 'Variant Price': '5' })]),
    )
    if (!result.ok) throw new Error('expected a summary')
    expect(result.summary.first.variants).toEqual([
      { label: 'Default', sku: '', weight: '', price: '5' },
    ])
  })

  it('reads column headings in any case and in any order, and copes with a missing column', () => {
    const result = summarizeImportCsv('TITLE,variant price,HANDLE\nMop,5,mop\n')
    if (!result.ok) throw new Error('expected a summary')
    expect(result.summary).toMatchObject({ products: 1, variants: 1 })
    expect(result.summary.first).toMatchObject({ title: 'Mop', vendor: '', status: '' })
  })

  it('refuses a file with no Handle column, saying so', () => {
    const result = summarizeImportCsv('Name,Price\nMop,5\n')
    expect(result).toEqual({ ok: false, error: expect.stringContaining('“Handle”') })
  })

  it('refuses an empty file, and one with headings only', () => {
    expect(summarizeImportCsv('')).toEqual({ ok: false, error: 'This file is empty.' })
    expect(summarizeImportCsv('Handle,Title\n')).toEqual({
      ok: false,
      error: 'This file has the column headings but no products.',
    })
  })

  it('ignores rows with no handle', () => {
    const result = summarizeImportCsv('Handle,Variant Price\n,5\nmop,6\n')
    if (!result.ok) throw new Error('expected a summary')
    expect(result.summary).toMatchObject({ products: 1, variants: 1 })
  })
})

describe('buildSampleImportCsv', () => {
  it('is a file this page can read back: one product, two variants, one picture', () => {
    const result = summarizeImportCsv(buildSampleImportCsv())
    if (!result.ok) throw new Error('expected a summary')

    expect(result.summary).toMatchObject({ products: 1, variants: 2, images: 1 })
    expect(result.summary.first.title).toBe('Hippo Bag')
    expect(result.summary.first.variants.map((variant) => variant.label)).toEqual([
      'Small',
      'Large',
    ])
  })

  it('starts with Shopify’s column headings', () => {
    const [header] = buildSampleImportCsv().split('\r\n')
    expect(
      header.startsWith('Handle,Title,Body (HTML),Vendor,Product Category,Type,Tags'),
    ).toBe(true)
    expect(header.split(',')).toContain('Variant Price')
  })
})
