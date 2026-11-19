import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api } from '../../../lib/api/endpoints.ts'
import {
  SAGE_CUSTOMER_MAX_PAGE_SIZE,
  type SageCustomerListParams,
  type SageCustomerSort,
  type SageCustomerTab,
} from '../../../lib/api/sageCustomers.ts'

export interface SageCustomerFilters {
  /** The list's tab ("all" = every customer). */
  tab: SageCustomerTab
  search: string
  /** '' = any, 'true' = also a CRM (Shopify) customer, 'false' = Sage only. */
  linked: '' | 'true' | 'false'
  /** Last invoice on or after / on or before, whole days (`YYYY-MM-DD`), either end may be empty. */
  invoicedFrom: string
  invoicedTo: string
  sort: SageCustomerSort
  order: 'asc' | 'desc'
  page: number
  pageSize: number
}

/** The API's own defaults: `?tab=all&sort=account_ref&order=asc&page=1&page_size=25`. */
export const DEFAULT_SAGE_CUSTOMER_FILTERS: SageCustomerFilters = {
  tab: 'all',
  search: '',
  linked: '',
  invoicedFrom: '',
  invoicedTo: '',
  sort: 'account_ref',
  order: 'asc',
  page: 1,
  pageSize: 25,
}

/** Filters → the query parameters the API understands (empty ones left out, page size ≤ 100). */
export function toSageCustomerParams(
  filters: SageCustomerFilters,
): SageCustomerListParams {
  const params: SageCustomerListParams = {
    // Always sent: `all` is a value of the tab, not an absence of one.
    tab: filters.tab,
    sort: filters.sort,
    order: filters.order,
    page: filters.page,
    page_size: Math.min(Math.max(1, filters.pageSize), SAGE_CUSTOMER_MAX_PAGE_SIZE),
  }
  const text = (name: string, value: string) => {
    const trimmed = value.trim()
    if (trimmed) params[name] = trimmed
  }
  text('search', filters.search)
  if (filters.linked) params.linked = filters.linked === 'true'
  if (filters.invoicedFrom) params.invoiced_from = filters.invoicedFrom
  if (filters.invoicedTo) params.invoiced_to = filters.invoicedTo
  return params
}

/** True when any narrowing filter (not sorting or paging) is applied. */
export function hasActiveSageCustomerFilters(filters: SageCustomerFilters): boolean {
  return (
    filters.tab !== 'all' ||
    filters.search.trim() !== '' ||
    filters.linked !== '' ||
    filters.invoicedFrom !== '' ||
    filters.invoicedTo !== ''
  )
}

/**
 * The Sage 50 customer list: filters, sorting, paging and the query behind them — all of it asked of
 * the API (`GET /api/sage/customers`), never worked out from the rows on screen. Each distinct query
 * is cached (TanStack Query), and while a new page or filter loads the previous rows stay on screen
 * instead of blanking the table. Asked for when the page opens — not before.
 */
export function useSageCustomers() {
  const [filters, setFilters] = useState<SageCustomerFilters>(
    DEFAULT_SAGE_CUSTOMER_FILTERS,
  )
  const params = toSageCustomerParams(filters)

  const query = useQuery({
    queryKey: ['sage-customers', params],
    queryFn: () => api.sageCustomers.list(params),
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
    hasFilters: hasActiveSageCustomerFilters(filters),

    /** Anything other than an explicit page change sends the user back to page 1. */
    setFilters: (changes: Partial<SageCustomerFilters>) =>
      setFilters((current) => ({
        ...current,
        ...changes,
        page: 'page' in changes ? (changes.page ?? 1) : 1,
      })),
    /** "Clear all": drops every narrowing filter, keeps the sort and the page size. */
    resetFilters: () =>
      setFilters((current) => ({
        ...DEFAULT_SAGE_CUSTOMER_FILTERS,
        sort: current.sort,
        order: current.order,
        pageSize: current.pageSize,
      })),
    retry: () => void query.refetch(),
  }
}
