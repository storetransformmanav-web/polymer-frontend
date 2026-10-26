import { useEffect } from 'react'
import { shallowEqual } from 'react-redux'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  customersCacheKey,
  fetchCustomers,
  statCountFilters,
  type CustomerFilters,
} from '../../../app/store/customersSlice.ts'

/**
 * The figures above the customers list. The API's list answer has no summary block, so each
 * one is the `total` of `GET /customers` for the current search/store/country/... filters
 * plus one more condition (`change`): every customer, only those with orders, only those
 * without, only those subscribed to email. A figure is `null` until it has loaded. Each is a
 * cached one-row query (see `statCountFilters`), so paging or re-sorting doesn't refetch
 * them. Pass a stable `changes` array.
 */
export function useCustomerStats(
  filters: CustomerFilters,
  changes: readonly Partial<CustomerFilters>[],
): (number | null)[] {
  const dispatch = useAppDispatch()

  const totals = useAppSelector(
    (state) =>
      changes.map(
        (change) =>
          state.customers.entries[customersCacheKey(statCountFilters(filters, change))]
            ?.data?.total ?? null,
      ),
    shallowEqual,
  )

  // Already-cached fresh counts are skipped by fetchCustomers' own `condition`.
  useEffect(() => {
    for (const change of changes) {
      void dispatch(fetchCustomers({ filters: statCountFilters(filters, change) }))
    }
  }, [dispatch, filters, changes])

  return totals
}
