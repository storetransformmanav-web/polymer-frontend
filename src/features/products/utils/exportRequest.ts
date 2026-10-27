import type { ProductFilters } from '../../../app/store/productsSlice.ts'
import type { ProductExportParams, ProductListItem } from '../../../lib/api/endpoints.ts'

/** Which products an export covers. */
export type ExportScope = 'page' | 'selected' | 'all' | 'matching'

/** "CSV for Excel…" gets a byte-order mark so accents and £ read correctly; "plain" is the file as sent. */
export type ExportFileFormat = 'excel' | 'plain'

/** What the export dialog hands over. */
export interface ProductsExportRequest {
  params: ProductExportParams
  format: ExportFileFormat
  /** What was exported, for the message ("25 products", "all products"). */
  summary: string
}

interface ExportContext {
  /** The products on the page being shown. */
  items: readonly ProductListItem[]
  /** The ticked products on that page. */
  selected: readonly ProductListItem[]
  /** The list's search and filters. */
  filters: ProductFilters
}

/** Does the list have a search or a filter the export API understands? */
export function hasExportableFilters(filters: ProductFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.status !== '' ||
    filters.productType !== '' ||
    filters.tag !== ''
  )
}

/** Is a filter on that the export API has no parameter for (so "matching" would be wrong)? */
export function hasUnsupportedFilters(filters: ProductFilters): boolean {
  return (
    filters.stock !== '' ||
    filters.minPrice.trim() !== '' ||
    filters.maxPrice.trim() !== ''
  )
}

/** The products by Shopify id, which every row of the list has. */
function idsOf(products: readonly ProductListItem[]): Pick<ProductExportParams, 'ids'> {
  return { ids: products.map((product) => product.shopify_id).join(',') }
}

/** The query for `GET /products/export` for a scope. */
export function buildExportParams(
  scope: ExportScope,
  { items, selected, filters }: ExportContext,
  includeMetafields: boolean,
): ProductExportParams {
  const params: ProductExportParams = { metafields: includeMetafields }
  if (filters.shop) params.shop = filters.shop

  if (scope === 'page') return { ...params, ...idsOf(items) }
  if (scope === 'selected') return { ...params, ...idsOf(selected) }
  if (scope === 'all') return params

  const search = filters.search.trim()
  if (search) params.search = search
  if (filters.status && filters.status !== 'UNLISTED') {
    params.status = filters.status.toLowerCase() as ProductExportParams['status']
  }
  if (filters.productType) params.product_type = filters.productType
  if (filters.tag) params.tag = filters.tag
  return params
}

/** `products_export_all-stores_20261027-1240.csv` — the name the backend's own file has. */
export function exportFilename(shop: string | undefined, now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  const store = (shop ?? '').replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '')
  return `products_export_${store || 'all-stores'}_${stamp}.csv`
}

/** The file to save: the text as sent, with a UTF-8 byte-order mark first for Excel. */
export function csvFile(text: string, format: ExportFileFormat): Blob {
  const body = text.startsWith('﻿') ? text.slice(1) : text
  return new Blob(format === 'excel' ? ['﻿', body] : [body], {
    type: 'text/csv;charset=utf-8',
  })
}
