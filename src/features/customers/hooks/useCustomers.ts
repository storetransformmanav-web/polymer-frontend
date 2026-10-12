import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  customerFiltersChanged,
  customerFiltersReset,
  customersCacheKey,
  fetchCustomerDetails,
  fetchCustomers,
  hasActiveCustomerFilters,
  prefetchCustomers,
  type CustomerFilters,
} from '../../../app/store/customersSlice.ts'

/**
 * Everything the Customers page needs, backed by the `customers` Redux
 * slice (see customersSlice.ts for the caching strategy).
 *
 * `data` is whatever can be shown *right now*: the current query's cached
 * page, or — while a new query loads — the previous page, so the table
 * never blanks out. `isPending` is true only when there's nothing at all
 * to show yet.
 */
export function useCustomers() {
  const dispatch = useAppDispatch()
  const filters = useAppSelector((state) => state.customers.filters)
  const entry = useAppSelector(
    (state) => state.customers.entries[customersCacheKey(state.customers.filters)],
  )
  const lastData = useAppSelector((state) => state.customers.lastData)
  const facets = useAppSelector((state) => state.customers.facets)

  const key = customersCacheKey(filters)

  // Load the current page (a no-op if it's cached and fresh) whenever the
  // query changes; stale cached data is shown instantly and refreshed here.
  useEffect(() => {
    dispatch(prefetchCustomers())
  }, [dispatch, key])

  // Warm the next page so "Next" is instant.
  const hasNext = entry?.data?.has_next ?? false
  useEffect(() => {
    if (hasNext) {
      void dispatch(fetchCustomers({ filters: { ...filters, page: filters.page + 1 } }))
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
    hasFilters: hasActiveCustomerFilters(filters),
    facets,

    setFilters: (changes: Partial<CustomerFilters>) =>
      dispatch(customerFiltersChanged(changes)),
    resetFilters: () => dispatch(customerFiltersReset()),
    retry: () => dispatch(fetchCustomers({ filters, force: true })),

    /** Start loading a customer's details (e.g. on hover) so opening is instant. */
    prefetchDetails: (id: string) => void dispatch(fetchCustomerDetails({ id })),
  }
}
