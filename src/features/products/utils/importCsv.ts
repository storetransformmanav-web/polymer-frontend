import { buildCsv, parseCsv } from '../../../lib/csv.ts'
import { htmlToText, statusLabel } from './format.ts'

/**
 * What the import dialog tells you about a Shopify-format products CSV before anything is
 * sent: how many products, variants and images it holds, and its first product as it will
 * look. It is read in the browser, from the file's own text (as Shopify's own import does),
 * so the preview doesn't depend on what the backend's check answers.
 */

export interface ImportVariantPreview {
  /** "Small / Red", or "Default" for a product without options. */
  label: string
  sku: string
  /** "500.00g" — from the Variant Grams column; empty when the file gives no weight. */
  weight: string
  /** The price as the file writes it ("24.90"). */
  price: string
}

export interface ImportProductPreview {
  handle: string
  title: string
  /** The description as plain text (the HTML is never put on the page as markup). */
  description: string
  status: string
  category: string
  type: string
  vendor: string
  variants: ImportVariantPreview[]
}

export interface ImportSummary {
  products: number
  /** Rows that are a variant (they give a SKU or a price). */
  variants: number
  /** Different image addresses, counted per product. */
  images: number
  first: ImportProductPreview
}

export type ImportCsvResult =
  { ok: true; summary: ImportSummary } | { ok: false; error: string }

const OPTION_VALUES = ['option1 value', 'option2 value', 'option3 value']

/** The columns of Shopify's product layout (a column may be missing: it just reads as blank). */
const SAMPLE_HEADERS = [
  'Handle',
  'Title',
  'Body (HTML)',
  'Vendor',
  'Product Category',
  'Type',
  'Tags',
  'Published',
  'Option1 Name',
  'Option1 Value',
  'Variant SKU',
  'Variant Grams',
  'Variant Inventory Tracker',
  'Variant Inventory Qty',
  'Variant Inventory Policy',
  'Variant Fulfillment Service',
  'Variant Price',
  'Variant Compare At Price',
  'Variant Requires Shipping',
  'Variant Taxable',
  'Variant Barcode',
  'Image Src',
  'Image Position',
  'Image Alt Text',
  'Gift Card',
  'SEO Title',
  'SEO Description',
  'Variant Weight Unit',
  'Status',
]

export const SAMPLE_IMPORT_FILENAME = 'sample-products-import.csv'

/** A small example file in Shopify's layout: one product with two variants and a picture. */
export function buildSampleImportCsv(): string {
  const row = (values: Record<string, string>) =>
    SAMPLE_HEADERS.map((header) => values[header] ?? '')
  return buildCsv(SAMPLE_HEADERS, [
    row({
      Handle: 'hippo-bag',
      Title: 'Hippo Bag',
      'Body (HTML)': '<p>A roomy bag for everyday use.</p>',
      Vendor: 'Polymer',
      Type: 'Bags',
      Tags: 'eco, bag',
      Published: 'TRUE',
      'Option1 Name': 'Size',
      'Option1 Value': 'Small',
      'Variant SKU': 'HB-S',
      'Variant Grams': '500',
      'Variant Inventory Tracker': 'shopify',
      'Variant Inventory Qty': '10',
      'Variant Inventory Policy': 'deny',
      'Variant Fulfillment Service': 'manual',
      'Variant Price': '24.90',
      'Variant Compare At Price': '29.90',
      'Variant Requires Shipping': 'TRUE',
      'Variant Taxable': 'TRUE',
      'Image Src': 'https://example.com/images/hippo-bag.jpg',
      'Image Position': '1',
      'Image Alt Text': 'Hippo Bag',
      'Gift Card': 'FALSE',
      'SEO Title': 'Hippo Bag',
      'SEO Description': 'A roomy bag for everyday use.',
      'Variant Weight Unit': 'g',
      Status: 'active',
    }),
    row({
      Handle: 'hippo-bag',
      'Option1 Value': 'Large',
      'Variant SKU': 'HB-L',
      'Variant Grams': '650',
      'Variant Inventory Tracker': 'shopify',
      'Variant Inventory Qty': '5',
      'Variant Inventory Policy': 'deny',
      'Variant Fulfillment Service': 'manual',
      'Variant Price': '25.50',
      'Variant Requires Shipping': 'TRUE',
      'Variant Taxable': 'TRUE',
      'Variant Weight Unit': 'g',
    }),
  ])
}

/** Reads the CSV text; a file that isn't a products CSV answers with what is wrong. */
export function summarizeImportCsv(text: string): ImportCsvResult {
  const rows = parseCsv(text)
  if (rows.length === 0) return { ok: false, error: 'This file is empty.' }

  const column = new Map<string, number>()
  rows[0].forEach((name, index) => {
    const key = name.trim().toLowerCase()
    if (key && !column.has(key)) column.set(key, index)
  })
  if (!column.has('handle')) {
    return {
      ok: false,
      error:
        'This doesn’t look like a Shopify products file: its first row has no “Handle” column. Use the sample CSV or an export from this page as the template.',
    }
  }
  const read = (row: readonly string[], name: string) =>
    (row[column.get(name) ?? -1] ?? '').trim()

  const handles = new Set<string>()
  const images = new Set<string>()
  let variants = 0
  const data = rows.slice(1).filter((row) => read(row, 'handle') !== '')
  if (data.length === 0) {
    return { ok: false, error: 'This file has the column headings but no products.' }
  }

  for (const row of data) {
    const handle = read(row, 'handle')
    handles.add(handle)
    if (read(row, 'variant sku') !== '' || read(row, 'variant price') !== '')
      variants += 1
    const image = read(row, 'image src')
    if (image !== '') images.add(`${handle}\u0000${image}`)
  }

  const firstHandle = read(data[0], 'handle')
  const firstRows = data.filter((row) => read(row, 'handle') === firstHandle)
  const head = firstRows[0]
  const grams = (row: readonly string[]) => {
    const value = Number(read(row, 'variant grams'))
    return read(row, 'variant grams') !== '' && Number.isFinite(value)
      ? `${value.toFixed(2)}g`
      : ''
  }

  return {
    ok: true,
    summary: {
      products: handles.size,
      variants,
      images: images.size,
      first: {
        handle: firstHandle,
        title: read(head, 'title'),
        description: htmlToText(read(head, 'body (html)')),
        status: read(head, 'status') ? statusLabel(read(head, 'status')) : '',
        category: read(head, 'product category'),
        type: read(head, 'type'),
        vendor: read(head, 'vendor'),
        variants: firstRows
          .filter(
            (row) => read(row, 'variant sku') !== '' || read(row, 'variant price') !== '',
          )
          .map((row) => ({
            label:
              OPTION_VALUES.map((name) => read(row, name))
                .filter(Boolean)
                .join(' / ') || 'Default',
            sku: read(row, 'variant sku'),
            weight: grams(row),
            price: read(row, 'variant price'),
          })),
      },
    },
  }
}
