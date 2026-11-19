import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api, type ProductActivityParams } from '../../../lib/api/endpoints.ts'

const MAX_PAGE_SIZE = 100

export interface ProductActivityFilters {
  /** A kind of change ('' = every kind). */
  group: string
  /** Where it was made ('' = anywhere). */
  source: string
  page: number
  pageSize: number
}

const DEFAULT_FILTERS: ProductActivityFilters = {
  group: '',
  source: '',
  page: 1,
  // The API's own default.
  pageSize: 50,
}

/**
 * One product's change history for its Activity tab: `GET /products/{id}/activity`, filtered by the
 * kind of change and its source and paged by the server, newest first. It is plain server data, so
 * TanStack Query (cached 30 s, the previous rows kept while another page or filter loads); it is asked
 * for only when the tab is opened (`enabled`), never when the product is merely viewed.
 */
export function useProductActivity(
  productId: string,
  shop: string | undefined,
  enabled: boolean,
) {
  const [filters, setFilters] = useState<ProductActivityFilters>(DEFAULT_FILTERS)

  const params: ProductActivityParams = {
    page: filters.page,
    page_size: Math.min(Math.max(1, filters.pageSize), MAX_PAGE_SIZE),
    ...(filters.group ? { group: filters.group } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(shop ? { shop } : {}),
  }

  const query = useQuery({
    queryKey: ['product-activity', productId, params],
    queryFn: () => api.products.activity(productId, params),
    enabled: enabled && productId !== '',
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

  return {
    filters,
    data: query.data ?? null,
    items: query.data?.items ?? [],
    /** Nothing to show yet (first load). */
    isPending: query.isPending,
    isFetching: query.isFetching,
    /** The rows on screen belong to the previous query while the new one loads. */
    isShowingPrevious: query.isPlaceholderData,
    error: query.isError && !query.data ? toUserMessage(query.error) : null,
    hasFilters: filters.group !== '' || filters.source !== '',
    /** Anything other than an explicit page change sends the user back to page 1. */
    setFilters: (changes: Partial<ProductActivityFilters>) =>
      setFilters((current) => ({
        ...current,
        ...changes,
        page: 'page' in changes ? (changes.page ?? 1) : 1,
      })),
    resetFilters: () =>
      setFilters((current) => ({ ...DEFAULT_FILTERS, pageSize: current.pageSize })),
    retry: () => void query.refetch(),
  }
}
