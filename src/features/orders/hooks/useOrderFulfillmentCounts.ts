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
 */
export function useOrderFulfillmentCounts(
  filters: OrderFilters,
  statuses: readonly (OrderFulfillmentStatus | '')[],
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
    for (const status of statuses) {
      void dispatch(fetchOrders({ filters: fulfillmentCountFilters(filters, status) }))
    }
  }, [dispatch, filters, statuses])

  return Object.fromEntries(statuses.map((status, i) => [status, totals[i] ?? null]))
}
