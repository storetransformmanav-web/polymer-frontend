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
 *
 * The counts only appear inside the status dropdown, so nothing is requested until
 * `enabled` (the Filters grid is open).
 */
export function useProductStatusCounts(
  filters: ProductFilters,
  statuses: readonly (ProductStatus | '')[],
  enabled = true,
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
    if (!enabled) return
    for (const status of statuses) {
      void dispatch(fetchProducts({ filters: statusCountFilters(filters, status) }))
    }
  }, [dispatch, enabled, filters, statuses])

  return Object.fromEntries(statuses.map((status, i) => [status, totals[i] ?? null]))
}
