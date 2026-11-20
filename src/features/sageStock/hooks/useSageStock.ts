import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api } from '../../../lib/api/endpoints.ts'
import {
  SAGE_STOCK_MAX_PAGE_SIZE,
  type SageStockListParams,
  type SageStockSort,
  type SageStockTab,
} from '../../../lib/api/sageStock.ts'

export interface SageStockFilters {
  /** The stock status ('all' = every item). */
  tab: SageStockTab
  search: string
  category: string
  supplierRef: string
  /** '' = any, 'true' = published on the web, 'false' = not published. */
  webPublished: '' | 'true' | 'false'
  /** '' = any, 'true' = a CRM / Shopify variant has this SKU, 'false' = Sage only. */
  linked: '' | 'true' | 'false'
  /** Last sold on or after this day (`YYYY-MM-DD`), or empty. */
  soldSince: string
  minPrice: string
  maxPrice: string
  sort: SageStockSort
  order: 'asc' | 'desc'
  page: number
  pageSize: number
}

/** The API's own defaults: `?tab=all&sort=stock_code&order=asc&page=1&page_size=25`. */
export const DEFAULT_SAGE_STOCK_FILTERS: SageStockFilters = {
  tab: 'all',
  search: '',
  category: '',
  supplierRef: '',
  webPublished: '',
  linked: '',
  soldSince: '',
  minPrice: '',
  maxPrice: '',
  sort: 'stock_code',
  order: 'asc',
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
export function toSageStockParams(filters: SageStockFilters): SageStockListParams {
  const params: SageStockListParams = {
    // Always sent: `all` is a value of the tab, not an absence of one.
    tab: filters.tab,
    sort: filters.sort,
    order: filters.order,
    page: filters.page,
    page_size: Math.min(Math.max(1, filters.pageSize), SAGE_STOCK_MAX_PAGE_SIZE),
  }
  const text = (name: string, value: string) => {
    const trimmed = value.trim()
    if (trimmed) params[name] = trimmed
  }
  text('search', filters.search)
  text('category', filters.category)
  text('supplier_ref', filters.supplierRef)
  if (filters.webPublished) params.web_published = filters.webPublished === 'true'
  if (filters.linked) params.linked = filters.linked === 'true'
  if (filters.soldSince) params.sold_since = filters.soldSince
  const min = amountParam(filters.minPrice)
  if (min !== null) params.min_price = min
  const max = amountParam(filters.maxPrice)
  if (max !== null) params.max_price = max
  return params
}

/** True when any narrowing filter (not sorting or paging) is applied. */
export function hasActiveSageStockFilters(filters: SageStockFilters): boolean {
  return (
    filters.tab !== 'all' ||
    filters.search.trim() !== '' ||
    filters.category.trim() !== '' ||
    filters.supplierRef.trim() !== '' ||
    filters.webPublished !== '' ||
    filters.linked !== '' ||
    filters.soldSince !== '' ||
    filters.minPrice.trim() !== '' ||
    filters.maxPrice.trim() !== ''
  )
}

/**
 * The Sage 50 stock list: filters, sorting, paging and the query behind them — all of it asked of the
 * API (`GET /api/sage/stock`), never worked out from the rows on screen. Each distinct query is cached
 * (TanStack Query), and while a new page or filter loads the previous rows stay on screen instead of
 * blanking the table. Asked for when the page opens — not before.
 */
export function useSageStock() {
  const [filters, setFilters] = useState<SageStockFilters>(DEFAULT_SAGE_STOCK_FILTERS)
  const params = toSageStockParams(filters)

  const query = useQuery({
    queryKey: ['sage-stock', params],
    queryFn: () => api.sageStock.list(params),
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
    hasFilters: hasActiveSageStockFilters(filters),

    /** Anything other than an explicit page change sends the user back to page 1. */
    setFilters: (changes: Partial<SageStockFilters>) =>
      setFilters((current) => ({
        ...current,
        ...changes,
        page: 'page' in changes ? (changes.page ?? 1) : 1,
      })),
    /** "Clear all": drops every narrowing filter, keeps the sort and the page size. */
    resetFilters: () =>
      setFilters((current) => ({
        ...DEFAULT_SAGE_STOCK_FILTERS,
        sort: current.sort,
        order: current.order,
        pageSize: current.pageSize,
      })),
    retry: () => void query.refetch(),
  }
}
