import { useQuery } from '@tanstack/react-query'
import { api } from '../../../lib/api/endpoints.ts'

/**
 * The Shopify locations a store keeps stock at, for the opening-stock field of
 * the new-product form. Plain server data, so TanStack Query: cached for five
 * minutes per store, and nothing is asked until a store is chosen. A store with
 * no stock rows yet simply has none — the form then leaves stock out.
 */
export function useStockLocations(shop: string) {
  const query = useQuery({
    queryKey: ['stock-locations', shop],
    queryFn: () => api.inventory.locations(shop),
    enabled: shop !== '',
    staleTime: 5 * 60_000,
  })
  return { locations: query.data ?? [], isLoading: query.isPending && shop !== '' }
}
