import { useQuery } from '@tanstack/react-query'
import { getProducts, type Product } from '../api/mockProducts.ts'

export type QueryStatus = 'loading' | 'success' | 'error'

export interface UseProductsResult {
  products: Product[]
  status: QueryStatus
  error: Error | null
}

/**
 * Loads the product list via TanStack Query. See useOrders.ts for the
 * rationale on the `{ products, status, error }` shape and the
 * `status` normalization.
 */
export function useProducts(): UseProductsResult {
  const query = useQuery({ queryKey: ['products'], queryFn: getProducts })

  return {
    products: query.data ?? [],
    status: query.isPending ? 'loading' : query.isError ? 'error' : 'success',
    error: query.error,
  }
}
