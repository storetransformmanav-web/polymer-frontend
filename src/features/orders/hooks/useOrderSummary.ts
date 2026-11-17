import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { OrderFilters } from '../../../app/store/ordersSlice.ts'
import { api } from '../../../lib/api/endpoints.ts'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { toOrderSummaryParams } from '../utils/summary.ts'

/**
 * The figures for the cards above the Orders list (`GET /orders/summary`): the list's filters without
 * its sorting and paging, so paging or sorting asks for nothing, and a change of filter or of the
 * top-bar store asks again. Same-filter answers are shared for 30 s; the previous figures stay on
 * screen while the next ones load.
 */
export function useOrderSummary(filters: OrderFilters) {
  const params = toOrderSummaryParams(filters)
  const query = useQuery({
    queryKey: ['order-summary', params],
    queryFn: () => api.orders.summary(params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
  return {
    summary: query.data ?? null,
    isPending: query.isPending,
    isFetching: query.isFetching,
    error: query.isError && !query.data ? toUserMessage(query.error) : null,
  }
}
