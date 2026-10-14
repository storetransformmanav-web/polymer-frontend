import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api, type UserListParams, type UserStatus } from '../../../lib/api/endpoints.ts'

export interface UserFilters {
  search: string
  /** A role name from the roles list ('' = every role). */
  role: string
  status: UserStatus | ''
  page: number
  pageSize: number
}

export const DEFAULT_USER_FILTERS: UserFilters = {
  search: '',
  role: '',
  status: '',
  page: 1,
  pageSize: 25,
}

/** Filters → the query parameters the API understands (empty ones omitted). */
export function toUserParams(filters: UserFilters): UserListParams {
  const params: UserListParams = { page: filters.page, page_size: filters.pageSize }

  const search = filters.search.trim()
  if (search) params.search = search
  if (filters.role) params.role = filters.role
  if (filters.status) params.status = filters.status

  return params
}

/**
 * The query that yields one status tab's count: the same narrowing filters
 * (search, role) with that status, one row per page — only `total` is read.
 */
export function statusCountFilters(
  filters: UserFilters,
  status: UserFilters['status'],
): UserFilters {
  return { ...filters, status, page: 1, pageSize: 1 }
}

/** True when any narrowing filter (not paging) is applied. */
export function hasActiveUserFilters(filters: UserFilters): boolean {
  return filters.search.trim() !== '' || filters.role !== '' || filters.status !== ''
}

/**
 * The Users list: filters, paging and the query behind them. Each distinct
 * query is cached (TanStack Query), and while a new page or filter loads the
 * previous rows stay on screen instead of blanking the table.
 */
export function useUsers() {
  const [filters, setFilters] = useState(DEFAULT_USER_FILTERS)
  const params = toUserParams(filters)

  const query = useQuery({
    queryKey: ['users', params],
    queryFn: () => api.users.list(params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

  return {
    filters,
    data: query.data ?? null,
    items: query.data?.items ?? [],
    /** Nothing to show yet (first load). */
    isPending: query.isPending,
    /** A request is in flight (first load, a new page/filter, or a refresh). */
    isFetching: query.isFetching,
    /** The rows on screen belong to the previous query while the new one loads. */
    isShowingPrevious: query.isPlaceholderData,
    error: query.isError && !query.data ? toUserMessage(query.error) : null,
    hasFilters: hasActiveUserFilters(filters),

    /** Anything other than an explicit page change sends the user back to page 1. */
    setFilters: (changes: Partial<UserFilters>) =>
      setFilters((current) => ({
        ...current,
        ...changes,
        page: 'page' in changes ? (changes.page ?? 1) : 1,
      })),
    /** "Clear all": drops every narrowing filter, keeps the page size. */
    resetFilters: () =>
      setFilters((current) => ({ ...DEFAULT_USER_FILTERS, pageSize: current.pageSize })),
    retry: () => void query.refetch(),
  }
}
