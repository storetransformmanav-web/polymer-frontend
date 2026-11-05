import {
  toCustomerParams,
  type CustomerFilters,
} from '../../../app/store/customersSlice.ts'
import type {
  CustomerExportParams,
  CustomerListItem,
} from '../../../lib/api/endpoints.ts'
import { csvExportFilename, type ExportFileFormat } from '../../../lib/csv.ts'

/** Which customers an export covers. */
export type CustomerExportScope = 'page' | 'all' | 'matching'

/** What the export dialog hands over. */
export interface CustomersExportRequest {
  params: CustomerExportParams
  format: ExportFileFormat
  /** What was exported, for the message ("25 customers", "all customers"). */
  summary: string
}

/** Does the list have a search or a filter on (so "matching" means something)? */
export function hasExportableFilters(filters: CustomerFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.role !== '' ||
    filters.state !== '' ||
    filters.marketing !== '' ||
    filters.orders !== '' ||
    filters.tag !== '' ||
    filters.country !== '' ||
    filters.minSpent.trim() !== '' ||
    filters.maxSpent.trim() !== ''
  )
}

/** The query for `GET /customer/export` for a scope. */
export function buildCustomerExportParams(
  scope: CustomerExportScope,
  items: readonly CustomerListItem[],
  filters: CustomerFilters,
): CustomerExportParams {
  // `role=all`, as on the list: without it the API answers subscribers only.
  const everyone: CustomerExportParams = { role: 'all' }
  if (filters.shop) everyone.shop = filters.shop

  if (scope === 'all') return everyone
  if (scope === 'page') {
    return { ...everyone, ids: items.map((customer) => customer.id).join(',') }
  }
  // The list's own question, without its paging and order: the file has every match.
  const list = toCustomerParams(filters)
  return {
    role: list.role,
    search: list.search,
    shop: list.shop,
    state: list.state,
    accepts_marketing: list.accepts_marketing,
    has_orders: list.has_orders,
    tag: list.tag,
    country: list.country,
    min_spent: list.min_spent,
    max_spent: list.max_spent,
  }
}

/** `customers_export_all-stores_20261027-1240.csv`. */
export function customerExportFilename(
  shop: string | undefined,
  now: Date = new Date(),
): string {
  return csvExportFilename('customers', shop, now)
}
