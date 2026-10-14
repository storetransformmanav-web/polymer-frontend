import { useEffect } from 'react'
import { shallowEqual } from 'react-redux'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  customersCacheKey,
  fetchCustomers,
  roleCountFilters,
  type CustomerFilters,
} from '../../../app/store/customersSlice.ts'
import type { CustomerRole } from '../../../lib/api/endpoints.ts'

/**
 * Number of customers per role tab ('' = All Customers), under the current
 * search/country/state/... filters. A count is `null` until it has loaded.
 * Each one is a cached one-row query (see `roleCountFilters`), so paging or
 * re-sorting doesn't refetch them. Pass a stable `roles` array.
 */
export function useCustomerRoleCounts(
  filters: CustomerFilters,
  roles: readonly (CustomerRole | '')[],
): Record<string, number | null> {
  const dispatch = useAppDispatch()

  const totals = useAppSelector(
    (state) =>
      roles.map(
        (role) =>
          state.customers.entries[customersCacheKey(roleCountFilters(filters, role))]
            ?.data?.total ?? null,
      ),
    shallowEqual,
  )

  // Already-cached fresh counts are skipped by fetchCustomers' own `condition`.
  useEffect(() => {
    for (const role of roles) {
      void dispatch(fetchCustomers({ filters: roleCountFilters(filters, role) }))
    }
  }, [dispatch, filters, roles])

  return Object.fromEntries(roles.map((role, i) => [role, totals[i] ?? null]))
}
