import { useQuery } from '@tanstack/react-query'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api } from '../../../lib/api/endpoints.ts'
import type { SalesOverviewParams } from '../../../lib/api/salesOverview.ts'

/** The most products the report puts in one list (the API's limit for `top`). */
export const SALES_MAX_TOP = 50

/**
 * The longer product lists behind "View all": the same report, period and store, asked for with the
 * largest `top` the API takes. Nothing is requested until a list is opened.
 */
export function useFullSalesLists(params: SalesOverviewParams, enabled: boolean) {
  const full: SalesOverviewParams = { ...params, top: SALES_MAX_TOP }
  const query = useQuery({
    queryKey: ['sales-overview', full],
    queryFn: () => api.products.salesOverview(full),
    staleTime: 60_000,
    enabled,
  })

  return {
    overview: query.data ?? null,
    error: query.isError && !query.data ? toUserMessage(query.error) : null,
    retry: () => void query.refetch(),
  }
}
