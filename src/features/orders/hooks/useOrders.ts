import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  fetchOrders,
  hasActiveOrderFilters,
  orderFiltersChanged,
  orderFiltersReset,
  ordersCacheKey,
  prefetchOrders,
  type OrderFilters,
} from '../../../app/store/ordersSlice.ts'

/**
 * Everything the Orders page needs, backed by the `orders` Redux slice (see
 * ordersSlice.ts for the caching strategy).
 *
 * `data` is whatever can be shown *right now*: the current query's cached page, or —
 * while a new query loads — the previous page, so the table never blanks out.
 * `isPending` is true only when there's nothing at all to show yet.
 */
export function useOrders() {
  const dispatch = useAppDispatch()
  const filters = useAppSelector((state) => state.orders.filters)
  const entry = useAppSelector(
    (state) => state.orders.entries[ordersCacheKey(state.orders.filters)],
  )
  const lastData = useAppSelector((state) => state.orders.lastData)
  const facets = useAppSelector((state) => state.orders.facets)

  const key = ordersCacheKey(filters)

  // Load the current page (a no-op if it's cached and fresh) whenever the
  // query changes; stale cached data is shown instantly and refreshed here.
  useEffect(() => {
    dispatch(prefetchOrders())
  }, [dispatch, key])

  // Warm the next page so "Next" is instant.
  const hasNext = entry?.data?.has_next ?? false
  useEffect(() => {
    if (hasNext) {
      void dispatch(fetchOrders({ filters: { ...filters, page: filters.page + 1 } }))
    }
  }, [dispatch, filters, hasNext])

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
    error: failed ? (entry?.error ?? null) : null,
    hasFilters: hasActiveOrderFilters(filters),
    facets,

    setFilters: (changes: Partial<OrderFilters>) =>
      dispatch(orderFiltersChanged(changes)),
    resetFilters: () => dispatch(orderFiltersReset()),
    retry: () => dispatch(fetchOrders({ filters, force: true })),
  }
}
