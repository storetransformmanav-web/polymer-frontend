import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
  type ThunkAction,
  type UnknownAction,
} from '@reduxjs/toolkit'
import { toUserMessage } from '../../lib/api/ApiError.ts'
import {
  api,
  type OrderDetail,
  type OrderFinancialStatus,
  type OrderFulfillmentStatus,
  type OrderListParams,
  type OrderListResponse,
  type OrderSort,
  type OrderSource,
} from '../../lib/api/endpoints.ts'
import { sessionCleared } from './authSlice.ts'
import { ALL_SHOPS, shopSelected } from './shopSlice.ts'

/**
 * Orders list, cached the same way as products and customers (see productsSlice.ts):
 * every page is kept by its exact query so revisits are instant, cached data is shown
 * first and refreshed in the background once stale, the previous results stay on screen
 * while a new query loads, and the next page is prefetched. Server data held in Redux on
 * purpose — see "Backend API" in CLAUDE.md.
 */

export const ORDERS_STALE_MS = 30_000

export interface OrderFilters {
  /** Order number, customer name, email, SKU or product title. */
  search: string
  /** The store picked in the top bar ('' = all). Set by `shopSelected`, not by this page's toolbar. */
  shop: string
  financial: OrderFinancialStatus | ''
  /** The tab strip: '' = every order. */
  fulfillment: OrderFulfillmentStatus | ''
  source: OrderSource | ''
  /** Payment gateway, e.g. shopify_payments. */
  gateway: string
  tag: string
  cancelled: '' | 'yes' | 'no'
  minTotal: string
  maxTotal: string
  /** Whole days (`YYYY-MM-DD`) from the date-range picker, or ''. */
  from: string
  to: string
  sort: OrderSort
  order: 'asc' | 'desc'
  page: number
  pageSize: number
}

export const DEFAULT_ORDER_FILTERS: OrderFilters = {
  search: '',
  shop: '',
  financial: '',
  fulfillment: '',
  source: '',
  gateway: '',
  tag: '',
  cancelled: '',
  minTotal: '',
  maxTotal: '',
  from: '',
  to: '',
  sort: 'created_at',
  order: 'desc',
  page: 1,
  pageSize: 25,
}

/** A whole day in the user's time zone → the ISO timestamp the API wants, or undefined. */
function dayBoundary(day: string, time: '00:00:00' | '23:59:59'): string | undefined {
  if (!day) return undefined
  const date = new Date(`${day}T${time}`)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

/** Filters → the query parameters the API understands (empty ones omitted). */
export function toOrderParams(filters: OrderFilters): OrderListParams {
  const params: OrderListParams = {
    sort: filters.sort,
    order: filters.order,
    page: filters.page,
    page_size: filters.pageSize,
  }

  const search = filters.search.trim()
  if (search) params.search = search
  if (filters.shop) params.shop = filters.shop
  if (filters.financial) params.financial_status = filters.financial
  if (filters.fulfillment) params.fulfillment_status = filters.fulfillment
  if (filters.source) params.source = filters.source
  if (filters.gateway) params.gateway = filters.gateway
  if (filters.tag) params.tag = filters.tag
  if (filters.cancelled) params.cancelled = filters.cancelled === 'yes'

  const min = Number.parseFloat(filters.minTotal)
  if (Number.isFinite(min) && min >= 0) params.min_total = min
  const max = Number.parseFloat(filters.maxTotal)
  if (Number.isFinite(max) && max >= 0) params.max_total = max

  const from = dayBoundary(filters.from, '00:00:00')
  if (from) params.from = from
  const to = dayBoundary(filters.to, '23:59:59')
  if (to) params.to = to

  return params
}

/** Cache key: two filter sets that produce the same request share one entry. */
export function ordersCacheKey(filters: OrderFilters): string {
  return JSON.stringify(toOrderParams(filters))
}

/**
 * The query that yields one fulfillment tab's count: the same narrowing filters
 * (search, payment, source, dates, ...) with that fulfillment status, one row per page —
 * only `total` is read. Sort/order are pinned so changing them reuses the cached count.
 */
export function fulfillmentCountFilters(
  filters: OrderFilters,
  fulfillment: OrderFulfillmentStatus | '',
): OrderFilters {
  return {
    ...filters,
    fulfillment,
    page: 1,
    pageSize: 1,
    sort: DEFAULT_ORDER_FILTERS.sort,
    order: DEFAULT_ORDER_FILTERS.order,
  }
}

/** True when any narrowing filter (not sort/paging) is applied. */
export function hasActiveOrderFilters(filters: OrderFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.financial !== '' ||
    filters.fulfillment !== '' ||
    filters.source !== '' ||
    filters.gateway !== '' ||
    filters.tag !== '' ||
    filters.cancelled !== '' ||
    filters.minTotal !== '' ||
    filters.maxTotal !== '' ||
    filters.from !== '' ||
    filters.to !== ''
  )
}

export interface OrdersEntry {
  data: OrderListResponse | null
  error: string | null
  isFetching: boolean
  fetchedAt: number | null
}

export interface OrdersFacets {
  tags: string[]
  gateways: string[]
}

export interface OrderDetailsEntry {
  data: OrderDetail | null
  error: string | null
  isFetching: boolean
  fetchedAt: number | null
}

/** Cache key of one order's details: the store (when known) and the order number. */
export function orderDetailsKey(ref: string, shop?: string | null): string {
  return `${shop ?? ''}|${ref}`
}

export interface OrdersState {
  filters: OrderFilters
  entries: Record<string, OrdersEntry>
  /** The most recent results shown, kept on screen while the next query loads. */
  lastData: OrderListResponse | null
  /** Distinct values seen so far — the API has no "list options" endpoint. */
  facets: OrdersFacets
  /** Order details, cached by `orderDetailsKey`. */
  details: Record<string, OrderDetailsEntry>
}

type OrdersRootState = { orders: OrdersState }

const initialState: OrdersState = {
  filters: DEFAULT_ORDER_FILTERS,
  entries: {},
  lastData: null,
  facets: { tags: [], gateways: [] },
  details: {},
}

interface FetchArg {
  filters: OrderFilters
  /** Refetch even if the cached page is still fresh. */
  force?: boolean
}

export const fetchOrders = createAsyncThunk<
  { data: OrderListResponse; fetchedAt: number },
  FetchArg,
  { state: OrdersRootState; rejectValue: string }
>(
  'orders/fetch',
  async ({ filters }, { rejectWithValue }) => {
    try {
      return {
        data: await api.orders.list(toOrderParams(filters)),
        fetchedAt: Date.now(),
      }
    } catch (error) {
      return rejectWithValue(toUserMessage(error))
    }
  },
  {
    // Skip if the same page is already in flight, or cached and still fresh.
    condition: ({ filters, force }, { getState }) => {
      const entry = getState().orders.entries[ordersCacheKey(filters)]
      if (entry?.isFetching) return false
      const isFresh =
        entry?.data != null &&
        entry.fetchedAt !== null &&
        Date.now() - entry.fetchedAt < ORDERS_STALE_MS
      return force || !isFresh
    },
  },
)

interface FetchDetailsArg {
  /** The order number (17516) — or the order's id. */
  ref: string
  /** The order's store key, when known. */
  shop?: string | null
  force?: boolean
}

export const fetchOrderDetails = createAsyncThunk<
  { data: OrderDetail; fetchedAt: number },
  FetchDetailsArg,
  { state: OrdersRootState; rejectValue: string }
>(
  'orders/fetchDetails',
  async ({ ref, shop }, { rejectWithValue }) => {
    try {
      return { data: await api.orders.details(ref, shop), fetchedAt: Date.now() }
    } catch (error) {
      return rejectWithValue(toUserMessage(error))
    }
  },
  {
    condition: ({ ref, shop, force }, { getState }) => {
      const entry = getState().orders.details[orderDetailsKey(ref, shop)]
      if (entry?.isFetching) return false
      const isFresh =
        entry?.data != null &&
        entry.fetchedAt !== null &&
        Date.now() - entry.fetchedAt < ORDERS_STALE_MS
      return force || !isFresh
    },
  },
)

function addSorted(list: string[], values: (string | null | undefined)[]) {
  let changed = false
  for (const value of values) {
    if (value && !list.includes(value)) {
      list.push(value)
      changed = true
    }
  }
  if (changed) list.sort((a, b) => a.localeCompare(b))
}

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    /**
     * Applies filter/sort/paging changes. Anything other than an explicit
     * page change sends the user back to page 1.
     */
    filtersChanged(state, action: PayloadAction<Partial<OrderFilters>>) {
      const next = { ...state.filters, ...action.payload }
      if (!('page' in action.payload)) next.page = 1
      state.filters = next

      // Cached already? Show it in the same render — no empty flash.
      const cached = state.entries[ordersCacheKey(next)]?.data
      if (cached) state.lastData = cached
    },
    /** "Clear all": drops every narrowing filter, keeps sort and page size. */
    filtersReset(state) {
      // The top-bar store isn't one of this page's filters, so it survives "Clear all".
      const { sort, order, pageSize, shop } = state.filters
      state.filters = { ...DEFAULT_ORDER_FILTERS, sort, order, pageSize, shop }
      const cached = state.entries[ordersCacheKey(state.filters)]?.data
      if (cached) state.lastData = cached
    },
  },
  extraReducers: (builder) => {
    builder
      // Leaving the session (logout / expired token) drops every cached page.
      .addCase(sessionCleared, () => initialState)
      // The top-bar store changed: query that store (from page 1), showing it at once if cached.
      .addCase(shopSelected, (state, action) => {
        const next = {
          ...state.filters,
          shop: action.payload === ALL_SHOPS ? '' : action.payload,
          page: 1,
        }
        state.filters = next
        const cached = state.entries[ordersCacheKey(next)]?.data
        if (cached) state.lastData = cached
      })
      .addCase(fetchOrders.pending, (state, action) => {
        const key = ordersCacheKey(action.meta.arg.filters)
        const entry = state.entries[key]
        state.entries[key] = {
          data: entry?.data ?? null,
          fetchedAt: entry?.fetchedAt ?? null,
          error: null,
          isFetching: true,
        }
      })
      .addCase(fetchOrders.fulfilled, (state, action) => {
        const key = ordersCacheKey(action.meta.arg.filters)
        const { data, fetchedAt } = action.payload
        state.entries[key] = { data, fetchedAt, error: null, isFetching: false }

        if (key === ordersCacheKey(state.filters)) state.lastData = data
        addSorted(
          state.facets.tags,
          data.items.flatMap((item) => item.tags),
        )
        addSorted(
          state.facets.gateways,
          data.items.flatMap((item) => item.payment_gateway_names),
        )
      })
      .addCase(fetchOrderDetails.pending, (state, action) => {
        const key = orderDetailsKey(action.meta.arg.ref, action.meta.arg.shop)
        const entry = state.details[key]
        state.details[key] = {
          data: entry?.data ?? null,
          fetchedAt: entry?.fetchedAt ?? null,
          error: null,
          isFetching: true,
        }
      })
      .addCase(fetchOrderDetails.fulfilled, (state, action) => {
        const key = orderDetailsKey(action.meta.arg.ref, action.meta.arg.shop)
        const { data, fetchedAt } = action.payload
        state.details[key] = { data, fetchedAt, error: null, isFetching: false }
      })
      .addCase(fetchOrderDetails.rejected, (state, action) => {
        if (action.meta.condition) return
        const key = orderDetailsKey(action.meta.arg.ref, action.meta.arg.shop)
        const entry = state.details[key]
        state.details[key] = {
          data: entry?.data ?? null,
          fetchedAt: entry?.fetchedAt ?? null,
          error: action.payload ?? 'Something went wrong. Please try again.',
          isFetching: false,
        }
      })
      .addCase(fetchOrders.rejected, (state, action) => {
        if (action.meta.condition) return
        const key = ordersCacheKey(action.meta.arg.filters)
        const entry = state.entries[key]
        state.entries[key] = {
          data: entry?.data ?? null,
          fetchedAt: entry?.fetchedAt ?? null,
          error: action.payload ?? 'Something went wrong. Please try again.',
          isFetching: false,
        }
      })
  },
})

export const { filtersChanged: orderFiltersChanged, filtersReset: orderFiltersReset } =
  ordersSlice.actions
export const ordersReducer = ordersSlice.reducer

/** Warms the cache for whatever filters are currently set (e.g. on app load). */
export const prefetchOrders =
  (): ThunkAction<void, OrdersRootState, unknown, UnknownAction> =>
  (dispatch, getState) => {
    void dispatch(fetchOrders({ filters: getState().orders.filters }))
  }
