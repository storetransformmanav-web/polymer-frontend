import { useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  customerDetailsKey,
  customerTabOpened,
  fetchCustomerDetails,
} from '../../../app/store/customersSlice.ts'

/**
 * One customer's details, from the Redux cache.
 *
 * Instant by design:
 *  - if the customer is cached (hover-prefetch, an earlier visit) `customer`
 *    is there on the first render;
 *  - otherwise `preview` — the matching row from the list we already
 *    loaded — lets the page draw its header and summary immediately while
 *    the rest loads;
 *  - cached data is refreshed quietly in the background once it's stale.
 *
 * The page never asks for Shopify's large "raw data" payload (`include_raw` is always
 * `false`): there is no Raw data tab.
 */
export function useCustomerDetails(id: string) {
  const dispatch = useAppDispatch()
  const entry = useAppSelector((state) => state.customers.details[customerDetailsKey(id)])
  const preview = useAppSelector(
    (state) => state.customers.lastData?.items.find((item) => item.id === id) ?? null,
  )

  useEffect(() => {
    // Opened from a bare URL: still gets a tab (labelled once the customer loads).
    dispatch(customerTabOpened({ id }))
    void dispatch(fetchCustomerDetails({ id }))
  }, [dispatch, id])

  const retry = useCallback(
    () => void dispatch(fetchCustomerDetails({ id, force: true })),
    [dispatch, id],
  )

  return {
    customer: entry?.data ?? null,
    preview,
    /** Nothing to show yet (no cache, no request answered). */
    isPending: !entry?.data && !entry?.error,
    isRefreshing: Boolean(entry?.isFetching && entry.data),
    error: entry?.data ? null : (entry?.error ?? null),
    retry,
  }
}
