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
  type CustomerState,
} from '../../lib/api/endpoints.ts'
import { sessionCleared } from './authSlice.ts'
import { ALL_SHOPS, shopSelected } from './shopSlice.ts'

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
  /** The store picked in the top bar ('' = all). Set by `shopSelected`, not by this page's toolbar. */
  shop: string
  /** '' = every role (sent to the API as 'all'). */
  role: CustomerRole | ''
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
  shop: '',
  role: '',
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
  if (filters.shop) params.shop = filters.shop
  // The API defaults to 'subscriber' when no role is sent, so "every role" must say so.
  params.role = filters.role || 'all'
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

/**
 * The query that yields one role tab's count: the same narrowing filters
 * (search, country, store, ...) with that role, one row per page — only
 * `total` is read. Sort/order are pinned so changing them reuses the cached count.
 */
export function roleCountFilters(
  filters: CustomerFilters,
  role: CustomerRole | '',
): CustomerFilters {
  return {
    ...filters,
    role,
    page: 1,
    pageSize: 1,
    sort: DEFAULT_CUSTOMER_FILTERS.sort,
    order: DEFAULT_CUSTOMER_FILTERS.order,
  }
}

/**
 * The query behind one of the figure cards above the list: the same narrowing filters as the
 * list (search, store, country...) with `change` applied on top (for example `orders: 'yes'`),
 * one row per page — only `total` is read. Sort/order are pinned so re-sorting reuses it.
 */
export function statCountFilters(
  filters: CustomerFilters,
  change: Partial<CustomerFilters>,
): CustomerFilters {
  return {
    ...filters,
    ...change,
    page: 1,
    pageSize: 1,
    sort: DEFAULT_CUSTOMER_FILTERS.sort,
    order: DEFAULT_CUSTOMER_FILTERS.order,
  }
}

/** True when any narrowing filter (not sort/paging) is applied. */
export function hasActiveCustomerFilters(filters: CustomerFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.role !== '' ||
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

export interface CustomerTab {
  id: string
  /** Not known when a details URL is opened directly; filled in on load. */
  name: string | null
  email: string | null
}

/** Most customers kept open as tabs; opening one more drops the oldest. */
const MAX_TABS = 10

/** The name a tab shows: full name, else first + last, else the email's local part. */
function tabName(customer: {
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
}): string | null {
  const full = customer.full_name?.trim()
  if (full) return full
  const joined = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()
  return joined || customer.email?.split('@')[0] || null
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
  /** Opened customers, shown as tabs above the list/details (oldest first). */
  tabs: CustomerTab[]
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
  tabs: [],
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

interface DeleteCustomerArg {
  id: string
  /** The customer's store key (sent as `shop=`), when known. */
  shop?: string | null
}

/**
 * Deletes a customer in the store and the CRM. On success it leaves every cached
 * list and details copy at once (see the `fulfilled` case below). Never retried.
 */
export const deleteCustomer = createAsyncThunk<
  { message: string },
  DeleteCustomerArg,
  { state: CustomersRootState; rejectValue: string }
>('customers/delete', async ({ id, shop }, { rejectWithValue }) => {
  try {
    return await api.customers.remove(id, shop)
  } catch (error) {
    return rejectWithValue(toUserMessage(error))
  }
})

/** Takes a deleted customer out of a cached page, keeping its totals right. */
function withoutCustomer(data: CustomerListResponse, id: string): CustomerListResponse {
  if (!data.items.some((item) => item.id === id)) return data
  const total = Math.max(0, data.total - 1)
  return {
    ...data,
    items: data.items.filter((item) => item.id !== id),
    total,
    total_pages: Math.max(1, Math.ceil(total / Math.max(1, data.page_size))),
  }
}

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
      // The top-bar store isn't one of this page's filters, so it survives "Clear all".
      const { sort, order, pageSize, shop } = state.filters
      state.filters = { ...DEFAULT_CUSTOMER_FILTERS, sort, order, pageSize, shop }
      const cached = state.entries[customersCacheKey(state.filters)]?.data
      if (cached) state.lastData = cached
    },
    /** Opens (or refreshes the label of) a customer tab; existing tabs keep their place. */
    tabOpened(
      state,
      action: PayloadAction<{ id: string; name?: string | null; email?: string | null }>,
    ) {
      const { id, name = null, email = null } = action.payload
      const existing = state.tabs.find((tab) => tab.id === id)
      if (existing) {
        existing.name ??= name
        existing.email ??= email
        return
      }
      state.tabs.push({ id, name, email })
      if (state.tabs.length > MAX_TABS) state.tabs.shift()
    },
    tabClosed(state, action: PayloadAction<string>) {
      state.tabs = state.tabs.filter((tab) => tab.id !== action.payload)
    },
    tabsCleared(state) {
      state.tabs = []
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
        const cached = state.entries[customersCacheKey(next)]?.data
        if (cached) state.lastData = cached
      })
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
        // A tab opened from a bare URL gets its label once the customer loads.
        const tab = state.tabs.find((candidate) => candidate.id === id)
        if (tab) {
          tab.name = tabName(data)
          tab.email = data.email || null
        }
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
      // A deleted customer disappears from every cached page and from the details cache
      // at once; every page is marked stale so each is re-read quietly (other rows may
      // move up, and the role counts change).
      .addCase(deleteCustomer.fulfilled, (state, action) => {
        const { id } = action.meta.arg
        for (const entry of Object.values(state.entries)) {
          if (entry.data) entry.data = withoutCustomer(entry.data, id)
          entry.fetchedAt = null
        }
        if (state.lastData) state.lastData = withoutCustomer(state.lastData, id)
        state.tabs = state.tabs.filter((tab) => tab.id !== id)
        delete state.details[customerDetailsKey(id)]
        delete state.details[customerDetailsKey(id, true)]
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
  tabOpened: customerTabOpened,
  tabClosed: customerTabClosed,
  tabsCleared: customerTabsCleared,
} = customersSlice.actions
export const customersReducer = customersSlice.reducer

/** Warms the cache for whatever filters are currently set (e.g. on app load). */
export const prefetchCustomers =
  (): ThunkAction<void, CustomersRootState, unknown, UnknownAction> =>
  (dispatch, getState) => {
    void dispatch(fetchCustomers({ filters: getState().customers.filters }))
  }
