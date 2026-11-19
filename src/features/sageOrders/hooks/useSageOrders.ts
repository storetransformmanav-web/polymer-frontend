import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api } from '../../../lib/api/endpoints.ts'
import {
  SAGE_ORDER_MAX_PAGE_SIZE,
  type SageOrderListParams,
  type SageOrderSort,
  type SageOrderStatus,
} from '../../../lib/api/sageOrders.ts'

export interface SageOrderFilters {
  /** The status ('all' = every order). */
  status: SageOrderStatus
  search: string
  accountRef: string
  takenBy: string
  /** Order date range, whole days (`YYYY-MM-DD`), either end may be empty. */
  from: string
  to: string
  minTotal: string
  maxTotal: string
  /** '' = any, 'true' = an invoice was raised, 'false' = not invoiced yet. */
  invoiced: '' | 'true' | 'false'
  sort: SageOrderSort
  order: 'asc' | 'desc'
  page: number
  pageSize: number
}

/** The API's own defaults: `?status=all&sort=number&order=desc&page=1&page_size=25`. */
export const DEFAULT_SAGE_ORDER_FILTERS: SageOrderFilters = {
  status: 'all',
  search: '',
  accountRef: '',
  takenBy: '',
  from: '',
  to: '',
  minTotal: '',
  maxTotal: '',
  invoiced: '',
  sort: 'number',
  order: 'desc',
  page: 1,
  pageSize: 25,
}

/** A number box's text as an amount the API takes, or null when it isn't one. */
function amountParam(value: string): string | null {
  const text = value.trim()
  if (text === '') return null
  const number = Number(text)
  return Number.isFinite(number) && number >= 0 ? String(number) : null
}

/** Filters → the query parameters the API understands (empty ones left out, page size ≤ 100). */
export function toSageOrderParams(filters: SageOrderFilters): SageOrderListParams {
  const params: SageOrderListParams = {
    // Always sent: `all` is a value of the status, not an absence of one.
    status: filters.status,
    sort: filters.sort,
    order: filters.order,
    page: filters.page,
    page_size: Math.min(Math.max(1, filters.pageSize), SAGE_ORDER_MAX_PAGE_SIZE),
  }
  const text = (name: string, value: string) => {
    const trimmed = value.trim()
    if (trimmed) params[name] = trimmed
  }
  text('search', filters.search)
  text('account_ref', filters.accountRef)
  text('taken_by', filters.takenBy)
  if (filters.from) params.from = filters.from
  if (filters.to) params.to = filters.to
  const min = amountParam(filters.minTotal)
  if (min !== null) params.min_total = min
  const max = amountParam(filters.maxTotal)
  if (max !== null) params.max_total = max
  if (filters.invoiced) params.invoiced = filters.invoiced === 'true'
  return params
}

/** True when any narrowing filter (not sorting or paging) is applied. */
export function hasActiveSageOrderFilters(filters: SageOrderFilters): boolean {
  return (
    filters.status !== 'all' ||
    filters.search.trim() !== '' ||
    filters.accountRef.trim() !== '' ||
    filters.takenBy.trim() !== '' ||
    filters.from !== '' ||
    filters.to !== '' ||
    filters.minTotal.trim() !== '' ||
    filters.maxTotal.trim() !== '' ||
    filters.invoiced !== ''
  )
}

/**
 * The Sage 50 order list: filters, sorting, paging and the query behind them — all of it asked of the
 * API (`GET /api/sage/orders`), never worked out from the rows on screen. Each distinct query is cached
 * (TanStack Query), and while a new page or filter loads the previous rows stay on screen instead of
 * blanking the table. Asked for when the page opens — not before.
 */
export function useSageOrders() {
  const [filters, setFilters] = useState<SageOrderFilters>(DEFAULT_SAGE_ORDER_FILTERS)
  const params = toSageOrderParams(filters)

  const query = useQuery({
    queryKey: ['sage-orders', params],
    queryFn: () => api.sageOrders.list(params),
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
    hasFilters: hasActiveSageOrderFilters(filters),

    /** Anything other than an explicit page change sends the user back to page 1. */
    setFilters: (changes: Partial<SageOrderFilters>) =>
      setFilters((current) => ({
        ...current,
        ...changes,
        page: 'page' in changes ? (changes.page ?? 1) : 1,
      })),
    /** "Clear all": drops every narrowing filter, keeps the sort and the page size. */
    resetFilters: () =>
      setFilters((current) => ({
        ...DEFAULT_SAGE_ORDER_FILTERS,
        sort: current.sort,
        order: current.order,
        pageSize: current.pageSize,
      })),
    retry: () => void query.refetch(),
  }
}
