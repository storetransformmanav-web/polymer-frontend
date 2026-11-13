import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import {
  api,
  type LockCustomerSort,
  type LockCustomersParams,
} from '../../../lib/api/endpoints.ts'

export interface LockCustomerFilters {
  search: string
  /** '' = every one of the lock's tags. */
  tag: string
  sort: LockCustomerSort
  page: number
  pageSize: number
}

export const DEFAULT_LOCK_CUSTOMER_FILTERS: LockCustomerFilters = {
  search: '',
  tag: '',
  sort: 'name',
  page: 1,
  pageSize: 25,
}

/** Filters → the query parameters the API understands (empty ones omitted). */
export function toLockCustomerParams(
  filters: LockCustomerFilters,
  shop: string,
): LockCustomersParams {
  const params: LockCustomersParams = {
    shop,
    sort: filters.sort,
    page: filters.page,
    page_size: filters.pageSize,
  }
  const search = filters.search.trim()
  if (search) params.search = search
  if (filters.tag) params.tag = filters.tag
  return params
}

/**
 * The customers who can see one locked product (`GET /access/locks/{product}/customers`): filters
 * (search, tag, sort), paging and the query behind them. Asked for only while the lock's Customers
 * tab is open; every query is cached under `['lock-customers']` (a write there refreshes them),
 * and the previous rows stay on screen while a new page or filter loads.
 */
export function useLockCustomers(shop: string, product: string, initialTag = '') {
  // A lock with its own tag starts on the customers chosen for it (the holders of that tag).
  const [filters, setFilters] = useState(() => ({
    ...DEFAULT_LOCK_CUSTOMER_FILTERS,
    tag: initialTag,
  }))
  const params = toLockCustomerParams(filters, shop)

  const query = useQuery({
    queryKey: ['lock-customers', shop, product, params],
    queryFn: () => api.access.lockCustomers(product, params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled: shop !== '' && product !== '',
  })

  return {
    filters,
    data: query.data ?? null,
    customers: query.data?.customers ?? [],
    /** The lock's tags with how many locked products share each. */
    tags: query.data?.tags ?? [],
    isPending: query.isPending,
    isFetching: query.isFetching,
    isShowingPrevious: query.isPlaceholderData,
    error: query.isError && !query.data ? toUserMessage(query.error) : null,
    hasFilters: filters.search.trim() !== '' || filters.tag !== initialTag,

    /** Anything other than an explicit page change sends the user back to page 1. */
    setFilters: (changes: Partial<LockCustomerFilters>) =>
      setFilters((current) => ({
        ...current,
        ...changes,
        page: 'page' in changes ? (changes.page ?? 1) : 1,
      })),
    resetFilters: () =>
      setFilters((current) => ({
        ...DEFAULT_LOCK_CUSTOMER_FILTERS,
        tag: initialTag,
        pageSize: current.pageSize,
      })),
    retry: () => void query.refetch(),
  }
}

/** What `useLockCustomers` returns (the list's data, filters and paging, held by the Check access tab). */
export type LockCustomersState = ReturnType<typeof useLockCustomers>
