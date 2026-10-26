import { useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  fetchOrderDetails,
  orderDetailsKey,
  orderTabOpened,
} from '../../../app/store/ordersSlice.ts'

/**
 * One order's details, from the Redux cache.
 *
 * Instant by design:
 *  - if the order is cached (hover-prefetch, an earlier visit) `order` is there on the
 *    first render;
 *  - otherwise `preview` — the matching row from the list already loaded — lets the page
 *    draw its header and summary immediately while the rest loads;
 *  - cached data is refreshed quietly in the background once it's stale.
 *
 * Shopify's large original payload is never requested (`include_raw=false`).
 */
export function useOrderDetails(ref: string, shop: string | null) {
  const dispatch = useAppDispatch()
  const entry = useAppSelector(
    (state) => state.orders.details[orderDetailsKey(ref, shop)],
  )
  const preview = useAppSelector(
    (state) =>
      state.orders.lastData?.items.find(
        (item) =>
          (String(item.order_number) === ref || item.id === ref) &&
          (!shop || item.shop?.key === shop),
      ) ?? null,
  )

  useEffect(() => {
    // Opened from a bare URL: still gets a tab (labelled once the order loads).
    dispatch(orderTabOpened({ ref, shop }))
    void dispatch(fetchOrderDetails({ ref, shop }))
  }, [dispatch, ref, shop])

  const retry = useCallback(
    () => void dispatch(fetchOrderDetails({ ref, shop, force: true })),
    [dispatch, ref, shop],
  )

  return {
    order: entry?.data ?? null,
    preview,
    /** Nothing to show yet (no cache, no request answered). */
    isPending: !entry?.data && !entry?.error,
    isRefreshing: Boolean(entry?.isFetching && entry.data),
    error: entry?.data ? null : (entry?.error ?? null),
    retry,
  }
}
