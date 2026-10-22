import {
  customersCacheKey,
  toCustomerParams,
  type CustomerFilters,
} from '../../../app/store/customersSlice.ts'
import type { CountSource } from '../../../hooks/useMatchingCount.ts'
import type { ExportSource } from '../../../hooks/useTableExport.ts'
import { api, type CustomerListItem } from '../../../lib/api/endpoints.ts'

/** How the customers export reads the list: 100 a page, the same query as the list. */
export const CUSTOMERS_EXPORT: ExportSource<CustomerListItem, CustomerFilters> = {
  noun: { one: 'customer', many: 'customers' },
  filenameBase: 'customers',
  sheetName: 'Customers',
  pageSize: 100,
  fetchPage: (filters, page, pageSize) =>
    api.customers.list(toCustomerParams({ ...filters, page, pageSize })),
  idOf: (item) => item.id,
}

/** How many customers match: the same query with paging and sort removed. */
export const CUSTOMERS_COUNT: CountSource<CustomerFilters> = {
  matchKey: (filters) =>
    customersCacheKey({
      ...filters,
      page: 1,
      pageSize: 1,
      sort: 'created_at',
      order: 'desc',
    }),
  count: async (filters) =>
    (await api.customers.list(toCustomerParams({ ...filters, page: 1, pageSize: 1 })))
      .total,
}
