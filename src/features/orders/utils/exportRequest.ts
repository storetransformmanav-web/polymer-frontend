import { toOrderParams, type OrderFilters } from '../../../app/store/ordersSlice.ts'
import type { OrderExportParams, OrderListItem } from '../../../lib/api/endpoints.ts'
import { csvExportFilename, type ExportFileFormat } from '../../../lib/csv.ts'

/** Which orders an export covers. */
export type OrderExportScope = 'page' | 'all' | 'matching'

/** What the export dialog hands over. */
export interface OrdersExportRequest {
  params: OrderExportParams
  format: ExportFileFormat
  /** What was exported, for the message ("25 orders", "all orders"). */
  summary: string
}

/** The query for `GET /orders/export` for a scope. */
export function buildOrderExportParams(
  scope: OrderExportScope,
  items: readonly OrderListItem[],
  filters: OrderFilters,
): OrderExportParams {
  const everyone: OrderExportParams = {}
  if (filters.shop) everyone.shop = filters.shop

  if (scope === 'all') return everyone
  if (scope === 'page') {
    return { ...everyone, ids: items.map((order) => order.id).join(',') }
  }
  // The list's own question — search, statuses, dates… — without its paging and order: the file
  // has every match.
  const {
    sort: _sort,
    order: _order,
    page: _page,
    page_size: _size,
    ...matching
  } = toOrderParams(filters)
  return matching
}

/** `orders_export_all-stores_20261027-1240.csv`. */
export function orderExportFilename(
  shop: string | undefined,
  now: Date = new Date(),
): string {
  return csvExportFilename('orders', shop, now)
}
