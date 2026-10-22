import {
  cacheKey,
  toParams,
  type ProductFilters,
} from '../../../app/store/productsSlice.ts'
import { api, type ProductListItem } from '../../../lib/api/endpoints.ts'
import type { CountSource } from '../../../hooks/useMatchingCount.ts'
import type { ExportSource } from '../../../hooks/useTableExport.ts'

/** How the products export reads the list: 100 a page, the same query as the list. */
export const PRODUCTS_EXPORT: ExportSource<ProductListItem, ProductFilters> = {
  noun: { one: 'product', many: 'products' },
  filenameBase: 'products',
  sheetName: 'Products',
  pageSize: 100,
  fetchPage: (filters, page, pageSize) =>
    api.products.list(toParams({ ...filters, page, pageSize })),
  idOf: (item) => item.id,
}

/** How many products match: the same query with paging and sort removed. */
export const PRODUCTS_COUNT: CountSource<ProductFilters> = {
  matchKey: (filters) =>
    cacheKey({ ...filters, page: 1, pageSize: 1, sort: 'created_at', order: 'desc' }),
  count: async (filters) =>
    (await api.products.list(toParams({ ...filters, page: 1, pageSize: 1 }))).total,
}
