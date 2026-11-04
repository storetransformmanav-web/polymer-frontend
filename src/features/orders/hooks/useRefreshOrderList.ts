import { useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  fetchOrders,
  fulfillmentCountFilters,
  ordersCacheKey,
} from '../../../app/store/ordersSlice.ts'
import { ORDER_FULFILLMENT_STATUSES } from '../../../lib/api/endpoints.ts'

/** Every fulfillment choice ('' = all), so the counts that were loaded can be refreshed together. */
const FULFILLMENT_CHOICES = ['', ...ORDER_FULFILLMENT_STATUSES] as const

/**
 * Refreshes the orders list for the current filters in the background — and, with `withCounts`,
 * the fulfillment counts that were already loaded (the Filters grid was opened). Whatever is on
 * screen stays until the new copy arrives, so nothing flashes or shows a loader. The figures
 * above the list come with the list's own answer, so they follow.
 */
export function useRefreshOrderList() {
  const dispatch = useAppDispatch()
  const filters = useAppSelector((state) => state.orders.filters)

  return useCallback(
    (withCounts = false) => {
      void dispatch(fetchOrders({ filters, force: true }))
      if (!withCounts) return
      // Only the counts already on hand: a page whose grid was never opened asks for nothing extra.
      void dispatch((_dispatch, getState) => {
        for (const choice of FULFILLMENT_CHOICES) {
          const countFilters = fulfillmentCountFilters(filters, choice)
          if (getState().orders.entries[ordersCacheKey(countFilters)]?.data == null) {
            continue
          }
          void _dispatch(fetchOrders({ filters: countFilters, force: true }))
        }
      })
    },
    [dispatch, filters],
  )
}
