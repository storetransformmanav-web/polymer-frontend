import { useEffect } from 'react'
import { shallowEqual } from 'react-redux'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  cacheKey,
  fetchProducts,
  statusCountFilters,
  type ProductFilters,
} from '../../../app/store/productsSlice.ts'
import type { ProductStatus } from '../../../lib/api/endpoints.ts'

/**
 * Number of products per status tab ('' = All Products), under the current
 * search/type/tag/stock/price filters. A count is `null` until it has
 * loaded. Each one is a cached one-row query (see `statusCountFilters`), so
 * paging or re-sorting doesn't refetch them. Pass a stable `statuses` array.
 */
export function useProductStatusCounts(
  filters: ProductFilters,
  statuses: readonly (ProductStatus | '')[],
): Record<string, number | null> {
  const dispatch = useAppDispatch()

  const totals = useAppSelector(
    (state) =>
      statuses.map(
        (status) =>
          state.products.entries[cacheKey(statusCountFilters(filters, status))]?.data
            ?.total ?? null,
      ),
    shallowEqual,
  )

  // Already-cached fresh counts are skipped by fetchProducts' own `condition`.
  useEffect(() => {
    for (const status of statuses) {
      void dispatch(fetchProducts({ filters: statusCountFilters(filters, status) }))
    }
  }, [dispatch, filters, statuses])

  return Object.fromEntries(statuses.map((status, i) => [status, totals[i] ?? null]))
}
