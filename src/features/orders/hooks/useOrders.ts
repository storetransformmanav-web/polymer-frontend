import { useQuery } from '@tanstack/react-query'
import { getOrders, type Order } from '../api/mockOrders.ts'

export type QueryStatus = 'loading' | 'success' | 'error'

export interface UseOrdersResult {
  orders: Order[]
  status: QueryStatus
  error: Error | null
}

/**
 * Loads the order list via TanStack Query (caching, refetch-on-focus,
 * etc. come for free). Returns the same `{ orders, status, error }`
 * shape the page expects, with `status` normalized to
 * `'loading' | 'success' | 'error'` rather than React Query's
 * `'pending' | 'success' | 'error'`, so pages render loading/empty/
 * error states explicitly instead of guessing from `orders.length`.
 */
export function useOrders(): UseOrdersResult {
  const query = useQuery({ queryKey: ['orders'], queryFn: getOrders })

  return {
    orders: query.data ?? [],
    status: query.isPending ? 'loading' : query.isError ? 'error' : 'success',
    error: query.error,
  }
}
