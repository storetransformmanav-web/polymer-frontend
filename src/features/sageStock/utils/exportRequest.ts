import type { SageStockExportParams, SageStockItem } from '../../../lib/api/sageStock.ts'
import type { ExportFileFormat } from '../../../lib/csv.ts'
import { toSageStockParams, type SageStockFilters } from '../hooks/useSageStock.ts'

/** Which stock items an export covers. */
export type SageStockExportScope = 'page' | 'all' | 'matching'

/** What the export dialog hands over. */
export interface SageStockExportRequest {
  params: SageStockExportParams
  format: ExportFileFormat
  /** What was exported, for the message ("25 items", "all items"). */
  summary: string
}

/** The query for `GET /sage/stock/export` for a scope. */
export function buildSageStockExportParams(
  scope: SageStockExportScope,
  items: readonly SageStockItem[],
  filters: SageStockFilters,
): SageStockExportParams {
  if (scope === 'all') return { tab: 'all' }
  if (scope === 'page') {
    // The rows on screen: their stock codes, comma-separated (the API takes up to 2000).
    return { stock_codes: items.map((item) => item.stock_code).join(',') }
  }
  // The list's own question — tab, search, filters, sorting — without its paging: the file has every match.
  const { page: _page, page_size: _size, ...matching } = toSageStockParams(filters)
  return matching
}

/** `sage_stock_export_20261027-1240.csv`. */
export function sageStockExportFilename(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `sage_stock_export_${stamp}.csv`
}
