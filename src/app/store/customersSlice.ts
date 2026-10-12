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
  type CustomerDetail,
  type CustomerListParams,
  type CustomerListResponse,
  type CustomerRole,
  type CustomerSort,
  type CustomerSource,
  type CustomerState,
} from '../../lib/api/endpoints.ts'
import { sessionCleared } from './authSlice.ts'

/**
 * Customers list, cached the same way as products (see productsSlice.ts):
 * every page is kept by its exact query so revisits are instant, cached
 * data is shown first and refreshed in the background once stale, the
 * previous results stay on screen while a new query loads, and the next
 * page is prefetched. Server data held in Redux on purpose — see "Backend
 * API" in CLAUDE.md.
 */

export const CUSTOMERS_STALE_MS = 30_000

export interface CustomerFilters {
  search: string
  role: CustomerRole | ''
  source: CustomerSource | ''
  state: CustomerState | ''
  marketing: '' | 'yes' | 'no'
  orders: '' | 'yes' | 'no'
  tag: string
  country: string
  minSpent: string
  maxSpent: string
  sort: CustomerSort
  order: 'asc' | 'desc'
  page: number
  pageSize: number
}

export const DEFAULT_CUSTOMER_FILTERS: CustomerFilters = {
  search: '',
  role: '',
  source: '',
  state: '',
  marketing: '',
  orders: '',
  tag: '',
  country: '',
  minSpent: '',
  maxSpent: '',
  sort: 'created_at',
  order: 'desc',
  page: 1,
  pageSize: 25,
}

/** Filters → the query parameters the API understands (empty ones omitted). */
export function toCustomerParams(filters: CustomerFilters): CustomerListParams {
  const params: CustomerListParams = {
    sort: filters.sort,
    order: filters.order,
    page: filters.page,
    page_size: filters.pageSize,
  }

  const search = filters.search.trim()
  if (search) params.search = search
  if (filters.role) params.role = filters.role
  if (filters.source) params.source = filters.source
  if (filters.state) params.state = filters.state
  if (filters.marketing) params.accepts_marketing = filters.marketing === 'yes'
  if (filters.orders) params.has_orders = filters.orders === 'yes'
  if (filters.tag) params.tag = filters.tag
  if (filters.country) params.country = filters.country

  const min = Number.parseFloat(filters.minSpent)
  if (Number.isFinite(min) && min >= 0) params.min_spent = min
  const max = Number.parseFloat(filters.maxSpent)
  if (Number.isFinite(max) && max >= 0) params.max_spent = max

  return params
}

/** Cache key: two filter sets that produce the same request share one entry. */
export function customersCacheKey(filters: CustomerFilters): string {
  return JSON.stringify(toCustomerParams(filters))
}

/** True when any narrowing filter (not sort/paging) is applied. */
export function hasActiveCustomerFilters(filters: CustomerFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.role !== '' ||
    filters.source !== '' ||
    filters.state !== '' ||
    filters.marketing !== '' ||
    filters.orders !== '' ||
    filters.tag !== '' ||
    filters.country !== '' ||
    filters.minSpent !== '' ||
    filters.maxSpent !== ''
  )
}

export interface CustomersEntry {
  data: CustomerListResponse | null
  error: string | null
  isFetching: boolean
  fetchedAt: number | null
}

export interface CustomersFacets {
  tags: string[]
  countries: string[]
}

export interface CustomersState {
  filters: CustomerFilters
  entries: Record<string, CustomersEntry>
  /** The most recent results shown, kept on screen while the next query loads. */
  lastData: CustomerListResponse | null
  /** Distinct values seen so far — the API has no "list options" endpoint. */
  facets: CustomersFacets
  /** Customer details, cached by id (and "id|raw" for the with-raw-data variant). */
  details: Record<string, CustomerDetailsEntry>
}

export interface CustomerDetailsEntry {
  data: CustomerDetail | null
  error: string | null
  isFetching: boolean
  fetchedAt: number | null
}

type CustomersRootState = { customers: CustomersState }

const initialState: CustomersState = {
  filters: DEFAULT_CUSTOMER_FILTERS,
  entries: {},
  lastData: null,
  facets: { tags: [], countries: [] },
  details: {},
}

interface FetchArg {
  filters: CustomerFilters
  /** Refetch even if the cached page is still fresh. */
  force?: boolean
}

export const fetchCustomers = createAsyncThunk<
  { data: CustomerListResponse; fetchedAt: number },
  FetchArg,
  { state: CustomersRootState; rejectValue: string }
>(
  'customers/fetch',
  async ({ filters }, { rejectWithValue }) => {
    try {
      return {
        data: await api.customers.list(toCustomerParams(filters)),
        fetchedAt: Date.now(),
      }
    } catch (error) {
      return rejectWithValue(toUserMessage(error))
    }
  },
  {
    // Skip if the same page is already in flight, or cached and still fresh.
    condition: ({ filters, force }, { getState }) => {
      const entry = getState().customers.entries[customersCacheKey(filters)]
      if (entry?.isFetching) return false
      const isFresh =
        entry?.data != null &&
        entry.fetchedAt !== null &&
        Date.now() - entry.fetchedAt < CUSTOMERS_STALE_MS
      return force || !isFresh
    },
  },
)

/** Cache key for a customer's details; the raw-data variant is cached separately. */
export function customerDetailsKey(id: string, raw = false): string {
  return raw ? `${id}|raw` : id
}

interface FetchDetailsArg {
  id: string
  /** Also load Shopify's original payload (only the "Raw data" tab needs it). */
  raw?: boolean
  force?: boolean
}

export const fetchCustomerDetails = createAsyncThunk<
  { data: CustomerDetail; fetchedAt: number },
  FetchDetailsArg,
  { state: CustomersRootState; rejectValue: string }
>(
  'customers/fetchDetails',
  async ({ id, raw = false }, { rejectWithValue }) => {
    try {
      return { data: await api.customers.details(id, raw), fetchedAt: Date.now() }
    } catch (error) {
      return rejectWithValue(toUserMessage(error))
    }
  },
  {
    condition: ({ id, raw, force }, { getState }) => {
      const entry = getState().customers.details[customerDetailsKey(id, raw)]
      if (entry?.isFetching) return false
      const isFresh =
        entry?.data != null &&
        entry.fetchedAt !== null &&
        Date.now() - entry.fetchedAt < CUSTOMERS_STALE_MS
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

const customersSlice = createSlice({
  name: 'customers',
  initialState,
  reducers: {
    /**
     * Applies filter/sort/paging changes. Anything other than an explicit
     * page change sends the user back to page 1.
     */
    filtersChanged(state, action: PayloadAction<Partial<CustomerFilters>>) {
      const next = { ...state.filters, ...action.payload }
      if (!('page' in action.payload)) next.page = 1
      state.filters = next

      // Cached already? Show it in the same render — no empty flash.
      const cached = state.entries[customersCacheKey(next)]?.data
      if (cached) state.lastData = cached
    },
    /** "Clear all": drops every narrowing filter, keeps sort and page size. */
    filtersReset(state) {
      const { sort, order, pageSize } = state.filters
      state.filters = { ...DEFAULT_CUSTOMER_FILTERS, sort, order, pageSize }
      const cached = state.entries[customersCacheKey(state.filters)]?.data
      if (cached) state.lastData = cached
    },
  },
  extraReducers: (builder) => {
    builder
      // Leaving the session (logout / expired token) drops every cached page.
      .addCase(sessionCleared, () => initialState)
      .addCase(fetchCustomers.pending, (state, action) => {
        const key = customersCacheKey(action.meta.arg.filters)
        const entry = state.entries[key]
        state.entries[key] = {
          data: entry?.data ?? null,
          fetchedAt: entry?.fetchedAt ?? null,
          error: null,
          isFetching: true,
        }
      })
      .addCase(fetchCustomers.fulfilled, (state, action) => {
        const key = customersCacheKey(action.meta.arg.filters)
        const { data, fetchedAt } = action.payload
        state.entries[key] = { data, fetchedAt, error: null, isFetching: false }

        if (key === customersCacheKey(state.filters)) state.lastData = data
        addSorted(
          state.facets.tags,
          data.items.flatMap((item) => item.tags),
        )
        addSorted(
          state.facets.countries,
          data.items.map((item) => item.country),
        )
      })
      .addCase(fetchCustomerDetails.pending, (state, action) => {
        const key = customerDetailsKey(action.meta.arg.id, action.meta.arg.raw)
        const entry = state.details[key]
        state.details[key] = {
          data: entry?.data ?? null,
          fetchedAt: entry?.fetchedAt ?? null,
          error: null,
          isFetching: true,
        }
      })
      .addCase(fetchCustomerDetails.fulfilled, (state, action) => {
        const { id, raw } = action.meta.arg
        const { data, fetchedAt } = action.payload
        state.details[customerDetailsKey(id, raw)] = {
          data,
          fetchedAt,
          error: null,
          isFetching: false,
        }
      })
      .addCase(fetchCustomerDetails.rejected, (state, action) => {
        if (action.meta.condition) return
        const key = customerDetailsKey(action.meta.arg.id, action.meta.arg.raw)
        const entry = state.details[key]
        state.details[key] = {
          data: entry?.data ?? null,
          fetchedAt: entry?.fetchedAt ?? null,
          error: action.payload ?? 'Something went wrong. Please try again.',
          isFetching: false,
        }
      })
      .addCase(fetchCustomers.rejected, (state, action) => {
        if (action.meta.condition) return
        const key = customersCacheKey(action.meta.arg.filters)
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

export const {
  filtersChanged: customerFiltersChanged,
  filtersReset: customerFiltersReset,
} = customersSlice.actions
export const customersReducer = customersSlice.reducer

/** Warms the cache for whatever filters are currently set (e.g. on app load). */
export const prefetchCustomers =
  (): ThunkAction<void, CustomersRootState, unknown, UnknownAction> =>
  (dispatch, getState) => {
    void dispatch(fetchCustomers({ filters: getState().customers.filters }))
  }
