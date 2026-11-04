import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  baseKey,
  cacheKey,
  fetchInventory,
  fetchVariantStock,
  filtersChanged,
  filtersReset,
  hasActiveFilters,
  prefetchInventory,
  type InventoryFilters,
} from '../../../app/store/inventorySlice.ts'

/**
 * Everything the Inventory list needs, backed by the `inventory` Redux slice (see
 * inventorySlice.ts for the caching strategy).
 *
 * `data` is whatever can be shown *right now*: the current query's cached page, or — while a
 * new query loads — the previous page, so the table never blanks out. `isPending` is true only
 * when there is nothing at all to show yet.
 */
export function useInventory() {
  const dispatch = useAppDispatch()
  const filters = useAppSelector((state) => state.inventory.filters)
  const entry = useAppSelector((state) => state.inventory.entries[cacheKey(filters)])
  const lastData = useAppSelector((state) => state.inventory.lastData)
  const baseTotals = useAppSelector((state) => state.inventory.baseTotals)
  const locations = useAppSelector((state) => state.inventory.locations)

  const key = cacheKey(filters)

  // Load the current page (a no-op if it is cached and fresh) whenever the query changes.
  useEffect(() => {
    dispatch(prefetchInventory())
  }, [dispatch, key])

  const failed = entry?.error != null && entry.data == null
  const data = entry?.data ?? (failed ? null : lastData)

  return {
    filters,
    data,
    items: data?.items ?? [],
    /** The figures above the list (the answer's `totals`). */
    totals: data?.totals ?? null,
    /** The chips' counts: the latest figures without a stock status, while it is for this narrowing. */
    baseTotals:
      baseTotals && baseTotals.key === baseKey(filters) ? baseTotals.totals : null,
    locations,
    /** Nothing to show yet (first load). */
    isPending: data === null && !failed,
    /** Showing results while a newer query (or a refresh) is in flight. */
    isFetching: entry?.isFetching ?? true,
    /** The rows on screen belong to the previous query. */
    isShowingPrevious: entry?.data == null && data !== null,
    error: failed ? entry.error : null,
    hasFilters: hasActiveFilters(filters),

    setFilters: (changes: Partial<InventoryFilters>) => dispatch(filtersChanged(changes)),
    resetFilters: () => dispatch(filtersReset()),
    retry: () => dispatch(fetchInventory({ filters, force: true })),

    /** Start loading a variant's stock (on hover) so opening it is instant. */
    prefetchDetails: (id: string) => void dispatch(fetchVariantStock({ ref: id })),
  }
}
