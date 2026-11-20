import { useQuery } from '@tanstack/react-query'
import { ApiError, toUserMessage } from '../../../lib/api/ApiError.ts'
import { api } from '../../../lib/api/endpoints.ts'

/**
 * One stock item in full, for its page: `GET /api/sage/stock/{stock_code}`, asked for when the page
 * opens with the code from the address (cached for 30 s, so going back and forth is instant). The
 * answer is the source of truth for everything the page shows; while it loads the header draws from the
 * list row.
 */
export function useSageStockDetail(stockCode: string) {
  const query = useQuery({
    queryKey: ['sage-stock-item', stockCode],
    queryFn: () => api.sageStock.detail(stockCode),
    enabled: stockCode !== '',
    staleTime: 30_000,
    // A 404 will not change by asking again.
    retry: (count, error) =>
      !(error instanceof ApiError && error.status === 404) && count < 1,
  })
  const missing = query.error instanceof ApiError && query.error.status === 404
  return {
    detail: query.data ?? null,
    isPending: query.isPending,
    /** Refreshing in the background while the page already shows the item. */
    isRefreshing: query.isFetching && !query.isPending,
    notFound: missing,
    error: query.isError && !query.data && !missing ? toUserMessage(query.error) : null,
    retry: () => void query.refetch(),
  }
}
