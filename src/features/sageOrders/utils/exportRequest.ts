import type {
  SageOrder,
  SageOrderExportLayout,
  SageOrderExportParams,
} from '../../../lib/api/sageOrders.ts'
import type { ExportFileFormat } from '../../../lib/csv.ts'
import { toSageOrderParams, type SageOrderFilters } from '../hooks/useSageOrders.ts'

/** Which orders an export covers. */
export type SageOrderExportScope = 'page' | 'all' | 'matching'

/** What the export dialog hands over. */
export interface SageOrdersExportRequest {
  params: SageOrderExportParams
  format: ExportFileFormat
  /** What was exported, for the message ("25 orders", "all orders"). */
  summary: string
}

/** The query for `GET /sage/orders/export` for a scope and a layout. */
export function buildSageOrderExportParams(
  scope: SageOrderExportScope,
  layout: SageOrderExportLayout,
  items: readonly SageOrder[],
  filters: SageOrderFilters,
): SageOrderExportParams {
  if (scope === 'all') return { layout, status: 'all' }
  if (scope === 'page') {
    // The rows on screen: their order numbers, comma-separated (the API takes up to 2000).
    return { layout, order_numbers: items.map((order) => order.order_number).join(',') }
  }
  // The list's own question — status, search, filters, sorting — without its paging: the file has every match.
  const { page: _page, page_size: _size, ...matching } = toSageOrderParams(filters)
  return { layout, ...matching }
}

/** `sage_orders_export_20261027-1240.csv`. */
export function sageOrderExportFilename(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `sage_orders_export_${stamp}.csv`
}
