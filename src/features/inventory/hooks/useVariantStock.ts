import { useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import { fetchVariantStock, tabOpened } from '../../../app/store/inventorySlice.ts'

/**
 * One variant's stock, from the Redux cache.
 *
 * Instant by design: a cached variant is there on the first render; otherwise `preview` — its
 * row from the list already loaded — lets the page draw its header and figures at once while the
 * rest loads; cached data is refreshed quietly once it is stale, and an edit patches it in place.
 */
export function useVariantStock(id: string) {
  const dispatch = useAppDispatch()
  const entry = useAppSelector((state) => state.inventory.details[id])
  const preview = useAppSelector(
    (state) =>
      state.inventory.lastData?.items.find((item) => item.variant_id === id) ?? null,
  )

  useEffect(() => {
    dispatch(tabOpened({ id }))
    void dispatch(fetchVariantStock({ ref: id }))
  }, [dispatch, id])

  const retry = useCallback(
    () => void dispatch(fetchVariantStock({ ref: id, force: true })),
    [dispatch, id],
  )

  return {
    variant: entry?.data ?? null,
    preview,
    /** Nothing to show yet (no cache, no request answered). */
    isPending: !entry?.data && !entry?.error,
    isRefreshing: Boolean(entry?.isFetching && entry.data),
    error: entry?.data ? null : (entry?.error ?? null),
    retry,
  }
}
