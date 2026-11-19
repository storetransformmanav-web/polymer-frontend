import type {
  SageCustomer,
  SageCustomerExportParams,
} from '../../../lib/api/sageCustomers.ts'
import type { ExportFileFormat } from '../../../lib/csv.ts'
import {
  toSageCustomerParams,
  type SageCustomerFilters,
} from '../hooks/useSageCustomers.ts'

/** Which customers an export covers. */
export type SageCustomerExportScope = 'page' | 'all' | 'matching'

/** What the export dialog hands over. */
export interface SageCustomersExportRequest {
  params: SageCustomerExportParams
  format: ExportFileFormat
  /** What was exported, for the message ("25 customers", "all customers"). */
  summary: string
}

/** The query for `GET /sage/customers/export` for a scope. */
export function buildSageCustomerExportParams(
  scope: SageCustomerExportScope,
  items: readonly SageCustomer[],
  filters: SageCustomerFilters,
): SageCustomerExportParams {
  if (scope === 'all') return { tab: 'all' }
  if (scope === 'page') {
    // The rows on screen: their account references, comma-separated (the API takes up to 2000).
    return { account_refs: items.map((customer) => customer.account_ref).join(',') }
  }
  // The list's own question — tab, search, filters, sorting — without its paging: the file has every match.
  const { page: _page, page_size: _size, ...matching } = toSageCustomerParams(filters)
  return matching
}

/** `sage_customers_export_20261027-1240.csv`. */
export function sageCustomerExportFilename(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `sage_customers_export_${stamp}.csv`
}
