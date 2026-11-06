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

/** What the cards above the list show: the four stock figures and the number of products. */
export interface StockFigures {
  summary: StockSummary
  /** The list answer's `total`: every product in the list, whatever its stock. */
  total: number | undefined
}

/**
 * The figures of the cards above the list. Normally they are the list answer's own
 * `stock_summary` and `total` (no request of their own). While a stock card is pressed,
 * though, that answer describes only the narrowed list — "In stock" on makes "Out of stock"
 * read 0, and `total` is only the products in stock — so the cards then read the answer for
 * the same list **without** the stock filter: one cached one-row query
 * (`stockSummaryFilters`), asked for only while the filter is on. Until it arrives they keep
 * showing the figures they had, so pressing a card never zeroes the others.
 */
export function useStockSummary(
  filters: ProductFilters,
  data: ProductListResponse | null,
): StockFigures {
  const dispatch = useAppDispatch()
  const narrowed = filters.stock !== ''
  const unfiltered = useMemo(() => stockSummaryFilters(filters), [filters])
  const own = useAppSelector(
    (state) => state.products.entries[cacheKey(unfiltered)]?.data,
  )

  // The last answer of a list that had no stock filter: shown at once when a card is pressed.
  const [last, setLast] = useState<StockFigures>({ summary: undefined, total: undefined })
  if (!narrowed && data?.stock_summary && last.summary !== data.stock_summary) {
    setLast({ summary: data.stock_summary, total: data.total })
  }

  // Already-cached fresh answers are skipped by fetchProducts' own `condition`.
  useEffect(() => {
    if (narrowed) void dispatch(fetchProducts({ filters: unfiltered }))
  }, [dispatch, narrowed, unfiltered])

  if (narrowed) {
    return {
      summary: own?.stock_summary ?? last.summary,
      total: own?.total ?? last.total,
    }
  }
  return { summary: data?.stock_summary, total: data?.total }
}
