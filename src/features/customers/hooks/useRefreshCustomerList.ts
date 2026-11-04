import { useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  customersCacheKey,
  fetchCustomers,
  roleCountFilters,
} from '../../../app/store/customersSlice.ts'

/** Every role choice of the Customer role filter, so their counts can be refreshed together. */
const ROLE_TABS = ['', 'administrator', 'subscriber'] as const

/**
 * Refreshes the customers list for the current filters — and, with `withCounts`, the role
 * counts — in the background. Whatever is on screen stays until the new copy arrives, so
 * nothing flashes or shows a loader. A role count is only re-read when it was already asked
 * for (the counts wait until the Filters grid is opened), so a refresh never adds requests
 * the page would not otherwise make.
 */
export function useRefreshCustomerList() {
  const dispatch = useAppDispatch()
  const filters = useAppSelector((state) => state.customers.filters)
  // One flag per role choice — "1" when its count has been asked for — as a string, so the
  // selector compares by value.
  const asked = useAppSelector((state) =>
    ROLE_TABS.map((role) =>
      state.customers.entries[
        customersCacheKey(roleCountFilters(state.customers.filters, role))
      ]
        ? '1'
        : '0',
    ).join(''),
  )

  return useCallback(
    (withCounts = false) => {
      void dispatch(fetchCustomers({ filters, force: true }))
      if (!withCounts) return
      ROLE_TABS.forEach((role, index) => {
        if (asked[index] !== '1') return
        void dispatch(
          fetchCustomers({ filters: roleCountFilters(filters, role), force: true }),
        )
      })
    },
    [dispatch, filters, asked],
  )
}
