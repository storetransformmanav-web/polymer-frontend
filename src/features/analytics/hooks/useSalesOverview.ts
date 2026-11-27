import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useAppSelector } from '../../../app/store/hooks.ts'
import { ALL_SHOPS } from '../../../app/store/shopSlice.ts'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api } from '../../../lib/api/endpoints.ts'
import type { SalesOverviewParams } from '../../../lib/api/salesOverview.ts'

/** How many products the backend is asked for in each list. */
export const SALES_TOP = 10

/** Whole days, `YYYY-MM-DD`; both empty = the backend's own default period. */
export interface SalesRange {
  from: string
  to: string
}

/**
 * The Analytics page's data (`GET /products/sales/overview`), asked for when the page opens. It
 * follows the top-bar store dropdown, and waits for that dropdown to settle on its starting store
 * so the page makes one request, not one per choice. The previous figures stay on screen while
 * another period or store loads.
 */
export function useSalesOverview() {
  const [range, setRange] = useState<SalesRange>({ from: '', to: '' })
  const shop = useAppSelector((state) => state.shop.selected)
  const shopSettled = useAppSelector(
    (state) => state.shop.defaultApplied || state.shop.status === 'error',
  )

  const params: SalesOverviewParams = { group_by: 'auto', top: SALES_TOP }
  if (range.from) params.date_from = range.from
  if (range.to) params.date_to = range.to
  if (shop !== ALL_SHOPS) params.shop = shop

  const backwards = Boolean(range.from && range.to && range.from > range.to)

  const query = useQuery({
    queryKey: ['sales-overview', params],
    queryFn: () => api.products.salesOverview(params),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled: shopSettled && !backwards,
  })

  return {
    range,
    setRange,
    /** The chosen days are the wrong way round: nothing is asked. */
    problem: backwards ? 'The first day must be before the last day.' : null,
    /** What was asked, so a longer list can ask about the same period and store. */
    params,
    shop: params.shop,
    overview: query.data ?? null,
    isFetching: query.isFetching,
    isShowingPrevious: query.isPlaceholderData,
    error: query.isError ? toUserMessage(query.error) : null,
    retry: () => void query.refetch(),
  }
}
