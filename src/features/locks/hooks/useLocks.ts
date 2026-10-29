import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import {
  api,
  type AccessLock,
  type AccessLockListParams,
  type LockSort,
  type LockSyncStatus,
} from '../../../lib/api/endpoints.ts'

export interface LockFilters {
  search: string
  /** '' = every lock. */
  status: '' | 'enabled' | 'disabled'
  /** '' = every sync state. */
  sync: '' | LockSyncStatus
  tag: string
  sort: LockSort
  page: number
  pageSize: number
}

export const DEFAULT_LOCK_FILTERS: LockFilters = {
  search: '',
  status: '',
  sync: '',
  tag: '',
  sort: 'updated_at',
  page: 1,
  pageSize: 25,
}

/** Filters → the query parameters the API understands (empty ones omitted). */
export function toLockParams(filters: LockFilters, shop: string): AccessLockListParams {
  const params: AccessLockListParams = {
    shop,
    sort: filters.sort,
    page: filters.page,
    page_size: filters.pageSize,
  }
  const search = filters.search.trim()
  if (search) params.search = search
  if (filters.tag) params.tag = filters.tag
  if (filters.status) params.enabled = filters.status === 'enabled'
  if (filters.sync) params.sync_status = filters.sync
  return params
}

/** True when any narrowing filter (not paging or sort) is applied. */
export function hasActiveLockFilters(filters: LockFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.status !== '' ||
    filters.sync !== '' ||
    filters.tag !== ''
  )
}

/**
 * The locked products of one store: filters, paging and the query behind them. Every query
 * is cached, and the previous rows stay on screen while a new page or filter loads.
 */
export function useLocks(shop: string) {
  const [filters, setFilters] = useState(DEFAULT_LOCK_FILTERS)
  const params = toLockParams(filters, shop)

  const query = useQuery({
    queryKey: ['locks', 'list', params],
    queryFn: () => api.access.locks(params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled: shop !== '',
  })

  return {
    filters,
    data: query.data ?? null,
    items: query.data?.locks ?? [],
    isPending: query.isPending,
    isFetching: query.isFetching,
    isShowingPrevious: query.isPlaceholderData,
    error: query.isError && !query.data ? toUserMessage(query.error) : null,
    hasFilters: hasActiveLockFilters(filters),

    /** Anything other than an explicit page change sends the user back to page 1. */
    setFilters: (changes: Partial<LockFilters>) =>
      setFilters((current) => ({
        ...current,
        ...changes,
        page: 'page' in changes ? (changes.page ?? 1) : 1,
      })),
    resetFilters: () =>
      setFilters((current) => ({ ...DEFAULT_LOCK_FILTERS, pageSize: current.pageSize })),
    retry: () => void query.refetch(),
  }
}

/**
 * One lock, for its details page. There is no single-lock call, so it is found in the list by
 * its handle (the list matches handles); it draws from the row already on the page meanwhile.
 */
export function useLockDetails(
  shop: string,
  handle: string | null,
  row: AccessLock | null,
) {
  const query = useQuery({
    queryKey: ['locks', 'one', shop, handle],
    queryFn: async () => {
      const answer = await api.access.locks({ shop, search: handle ?? '', page_size: 25 })
      return answer.locks.find((lock) => lock.handle === handle) ?? null
    },
    placeholderData: row ?? undefined,
    staleTime: 30_000,
    enabled: shop !== '' && !!handle,
  })

  return {
    lock: query.data ?? row,
    /** Loaded, and the store has no such lock. */
    notFound: query.isSuccess && !query.isPlaceholderData && !query.data,
    isFetching: query.isFetching,
    error: query.isError && !query.data && !row ? toUserMessage(query.error) : null,
    retry: () => void query.refetch(),
  }
}
