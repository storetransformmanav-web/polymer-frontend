import { useEffect, useMemo, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  cacheKey,
  fetchProducts,
  stockSummaryFilters,
  type ProductFilters,
} from '../../../app/store/productsSlice.ts'
import type { ProductListResponse } from '../../../lib/api/endpoints.ts'

type StockSummary = ProductListResponse['stock_summary']

/**
 * The figures of the four stock cards. Normally they are the list answer's own
 * `stock_summary` (no request of their own). While a stock card is pressed, though, that
 * answer describes only the narrowed list — "In stock" on makes "Out of stock" read 0 — so
 * the cards then read the summary of the same list **without** the stock filter: one cached
 * one-row query (`stockSummaryFilters`), asked for only while the filter is on. Until it
 * arrives they keep showing the figures they had, so pressing a card never zeroes the others.
 */
export function useStockSummary(
  filters: ProductFilters,
  data: ProductListResponse | null,
): StockSummary {
  const dispatch = useAppDispatch()
  const narrowed = filters.stock !== ''
  const unfiltered = useMemo(() => stockSummaryFilters(filters), [filters])
  const own = useAppSelector(
    (state) => state.products.entries[cacheKey(unfiltered)]?.data?.stock_summary,
  )

  // The last summary of a list that had no stock filter: shown at once when a card is pressed.
  const [last, setLast] = useState<StockSummary>(undefined)
  if (!narrowed && data?.stock_summary && last !== data.stock_summary) {
    setLast(data.stock_summary)
  }

  // Already-cached fresh answers are skipped by fetchProducts' own `condition`.
  useEffect(() => {
    if (narrowed) void dispatch(fetchProducts({ filters: unfiltered }))
  }, [dispatch, narrowed, unfiltered])

  return narrowed ? (own ?? last) : data?.stock_summary
}
