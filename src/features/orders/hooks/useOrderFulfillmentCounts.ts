import { useEffect } from 'react'
import { shallowEqual } from 'react-redux'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  fetchOrders,
  fulfillmentCountFilters,
  ordersCacheKey,
  type OrderFilters,
} from '../../../app/store/ordersSlice.ts'
import type { OrderFulfillmentStatus } from '../../../lib/api/endpoints.ts'

/**
 * Number of orders per fulfillment tab ('' = All Orders), under the current
 * search/payment/source/date/... filters. A count is `null` until it has loaded.
 * Each one is a cached one-row query (see `fulfillmentCountFilters`), so paging or
 * re-sorting doesn't refetch them. Pass a stable `statuses` array.
 *
 * The counts only appear inside the fulfillment dropdown, so nothing is requested until
 * `enabled` (the Filters grid is open).
 */
export function useOrderFulfillmentCounts(
  filters: OrderFilters,
  statuses: readonly (OrderFulfillmentStatus | '')[],
  enabled = true,
): Record<string, number | null> {
  const dispatch = useAppDispatch()

  const totals = useAppSelector(
    (state) =>
      statuses.map(
        (status) =>
          state.orders.entries[ordersCacheKey(fulfillmentCountFilters(filters, status))]
            ?.data?.total ?? null,
      ),
    shallowEqual,
  )

  // Already-cached fresh counts are skipped by fetchOrders' own `condition`.
  useEffect(() => {
    if (!enabled) return
    for (const status of statuses) {
      void dispatch(fetchOrders({ filters: fulfillmentCountFilters(filters, status) }))
    }
  }, [dispatch, enabled, filters, statuses])

  return Object.fromEntries(statuses.map((status, i) => [status, totals[i] ?? null]))
}
