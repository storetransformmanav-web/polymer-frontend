import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  cacheKey,
  fetchProductDetails,
  fetchProducts,
  filtersChanged,
  filtersReset,
  hasActiveFilters,
  prefetchProducts,
  type ProductFilters,
} from '../../../app/store/productsSlice.ts'

/**
 * Everything the Products page needs, backed by the `products` Redux slice
 * (see productsSlice.ts for the caching strategy).
 *
 * `data` is whatever can be shown *right now*: the current query's cached
 * page, or — while a new query loads — the previous page, so the table
 * never blanks out. `isPending` is true only when there's nothing at all
 * to show yet.
 */
export function useProducts() {
  const dispatch = useAppDispatch()
  const filters = useAppSelector((state) => state.products.filters)
  const entry = useAppSelector((state) => state.products.entries[cacheKey(filters)])
  const lastData = useAppSelector((state) => state.products.lastData)
  const facets = useAppSelector((state) => state.products.facets)

  const key = cacheKey(filters)

  // Load the current page (a no-op if it's cached and fresh) whenever the
  // query changes; stale cached data is shown instantly and refreshed here.
  useEffect(() => {
    dispatch(prefetchProducts())
  }, [dispatch, key])

  const failed = entry?.error != null && entry.data == null
  const data = entry?.data ?? (failed ? null : lastData)

  return {
    filters,
    data,
    items: data?.items ?? [],
    /** Nothing to show yet (first load). */
    isPending: data === null && !failed,
    /** Showing results while a newer query (or a refresh) is in flight. */
    isFetching: entry?.isFetching ?? true,
    /** The rows on screen belong to the previous query. */
    isShowingPrevious: entry?.data == null && data !== null,
    error: failed ? entry.error : null,
    hasFilters: hasActiveFilters(filters),
    facets,

    setFilters: (changes: Partial<ProductFilters>) => dispatch(filtersChanged(changes)),
    resetFilters: () => dispatch(filtersReset()),
    retry: () => dispatch(fetchProducts({ filters, force: true })),

    /** Start loading a product's details (e.g. on hover) so opening it is instant. */
    prefetchDetails: (id: string) => void dispatch(fetchProductDetails({ id })),
  }
}
