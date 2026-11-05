import type { ProductFilters } from '../../../app/store/productsSlice.ts'
import type { ProductExportParams, ProductListItem } from '../../../lib/api/endpoints.ts'
import { csvExportFilename, csvFile, type ExportFileFormat } from '../../../lib/csv.ts'

/** Which products an export covers. */
export type ExportScope = 'page' | 'selected' | 'all' | 'matching'

export type { ExportFileFormat }
export { csvFile }

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
  return csvExportFilename('products', shop, now)
}
