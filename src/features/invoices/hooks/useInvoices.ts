import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api } from '../../../lib/api/endpoints.ts'
import {
  INVOICE_KIND_ALL,
  INVOICE_MAX_PAGE_SIZE,
  INVOICE_PARAM,
  type InvoiceKind,
  type InvoiceListParams,
  type InvoicePaymentStatus,
  type InvoiceSort,
} from '../../../lib/api/invoices.ts'

export interface InvoiceFilters {
  /** A document type ('' = every type). */
  kind: InvoiceKind | ''
  search: string
  accountRef: string
  paymentStatus: InvoicePaymentStatus | ''
  takenBy: string
  /** Invoice date range, whole days (`YYYY-MM-DD`), either end may be empty. */
  from: string
  to: string
  minTotal: string
  maxTotal: string
  sort: InvoiceSort
  order: 'asc' | 'desc'
  page: number
  pageSize: number
}

export const DEFAULT_INVOICE_FILTERS: InvoiceFilters = {
  kind: '',
  search: '',
  accountRef: '',
  paymentStatus: '',
  takenBy: '',
  from: '',
  to: '',
  minTotal: '',
  maxTotal: '',
  // The API's own default: `?kind=all&sort=number&order=desc`.
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
export function toInvoiceParams(filters: InvoiceFilters): InvoiceListParams {
  const params: InvoiceListParams = {
    [INVOICE_PARAM.page]: filters.page,
    [INVOICE_PARAM.pageSize]: Math.min(
      Math.max(1, filters.pageSize),
      INVOICE_MAX_PAGE_SIZE,
    ),
    [INVOICE_PARAM.sort]: filters.sort,
    [INVOICE_PARAM.order]: filters.order,
  }
  const text = (name: string, value: string) => {
    const trimmed = value.trim()
    if (trimmed) params[name] = trimmed
  }
  // Always sent: `all` is a value of the type filter, not an absence of one.
  params[INVOICE_PARAM.kind] = filters.kind || INVOICE_KIND_ALL
  text(INVOICE_PARAM.search, filters.search)
  text(INVOICE_PARAM.accountRef, filters.accountRef)
  if (filters.paymentStatus) params[INVOICE_PARAM.paymentStatus] = filters.paymentStatus
  text(INVOICE_PARAM.takenBy, filters.takenBy)
  if (filters.from) params[INVOICE_PARAM.from] = filters.from
  if (filters.to) params[INVOICE_PARAM.to] = filters.to
  const min = amountParam(filters.minTotal)
  if (min !== null) params[INVOICE_PARAM.minTotal] = min
  const max = amountParam(filters.maxTotal)
  if (max !== null) params[INVOICE_PARAM.maxTotal] = max
  return params
}

/** True when any narrowing filter (not sorting or paging) is applied. */
export function hasActiveInvoiceFilters(filters: InvoiceFilters): boolean {
  return (
    filters.kind !== '' ||
    filters.search.trim() !== '' ||
    filters.accountRef.trim() !== '' ||
    filters.paymentStatus !== '' ||
    filters.takenBy.trim() !== '' ||
    filters.from !== '' ||
    filters.to !== '' ||
    filters.minTotal.trim() !== '' ||
    filters.maxTotal.trim() !== ''
  )
}

/**
 * The Sage 50 invoice list: filters, sorting, paging and the query behind them — all of it asked
 * of the API (`GET /api/sage/invoices`), never worked out from the rows on screen. Each distinct query
 * is cached (TanStack Query), and while a new page or filter loads the previous rows stay on
 * screen instead of blanking the table.
 */
export function useInvoices(initial: Partial<InvoiceFilters> = {}) {
  // `initial` pins a list to something from the start (a customer's invoices: its account
  // reference, newest first) — "Clear all" goes back to it, not to the page-wide default.
  const [filters, setFilters] = useState<InvoiceFilters>(() => ({
    ...DEFAULT_INVOICE_FILTERS,
    ...initial,
  }))
  const params = toInvoiceParams(filters)

  const query = useQuery({
    queryKey: ['invoices', params],
    queryFn: () => api.invoices.list(params),
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
    hasFilters: hasActiveInvoiceFilters(filters),

    /** Anything other than an explicit page change sends the user back to page 1. */
    setFilters: (changes: Partial<InvoiceFilters>) =>
      setFilters((current) => ({
        ...current,
        ...changes,
        page: 'page' in changes ? (changes.page ?? 1) : 1,
      })),
    /** "Clear all": drops every narrowing filter, keeps the sort and the page size. */
    resetFilters: () =>
      setFilters((current) => ({
        ...DEFAULT_INVOICE_FILTERS,
        ...initial,
        sort: current.sort,
        order: current.order,
        pageSize: current.pageSize,
      })),
    retry: () => void query.refetch(),
  }
}
