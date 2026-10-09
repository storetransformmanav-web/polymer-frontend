import { useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  detailsKey,
  fetchProductDetails,
  tabOpened,
} from '../../../app/store/productsSlice.ts'

/**
 * One product's details, from the Redux cache.
 *
 * Instant by design:
 *  - if the product is cached (hover-prefetch, an earlier visit) `product`
 *    is there on the first render;
 *  - otherwise `preview` — the matching row from the list we already
 *    loaded — lets the page draw its header, image and price immediately
 *    while the rest loads;
 *  - cached data is refreshed quietly in the background once it's stale.
 *
 * The Shopify "raw data" payload is large, so it's only requested on
 * demand via `loadRaw()` (the Raw data tab).
 */
export function useProductDetails(id: string) {
  const dispatch = useAppDispatch()
  const entry = useAppSelector((state) => state.products.details[detailsKey(id)])
  const rawEntry = useAppSelector((state) => state.products.details[detailsKey(id, true)])
  const preview = useAppSelector(
    (state) => state.products.lastData?.items.find((item) => item.id === id) ?? null,
  )

  useEffect(() => {
    dispatch(tabOpened({ id }))
    void dispatch(fetchProductDetails({ id }))
  }, [dispatch, id])

  const retry = useCallback(
    () => void dispatch(fetchProductDetails({ id, force: true })),
    [dispatch, id],
  )
  const loadRaw = useCallback(
    () => void dispatch(fetchProductDetails({ id, raw: true })),
    [dispatch, id],
  )

  return {
    product: entry?.data ?? null,
    preview,
    /** Nothing to show yet (no cache, no request answered). */
    isPending: !entry?.data && !entry?.error,
    isRefreshing: Boolean(entry?.isFetching && entry.data),
    error: entry?.data ? null : (entry?.error ?? null),
    retry,

    raw: rawEntry?.data?.raw_json ?? null,
    isRawLoading: rawEntry?.isFetching ?? false,
    rawError: rawEntry?.data ? null : (rawEntry?.error ?? null),
    loadRaw,
  }
}
