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
  type ProductDetail,
  type ProductListParams,
  type ProductListResponse,
  type ProductSort,
  type ProductStatus,
} from '../../lib/api/endpoints.ts'
import { sessionCleared } from './authSlice.ts'

/**
 * Products list, built for instant-feeling navigation:
 *  - every page is cached by its exact query, so revisiting a page, a
 *    filter or a sort order renders immediately from memory;
 *  - cached data is shown first and quietly refreshed once it's older
 *    than `PRODUCTS_STALE_MS` (stale-while-revalidate);
 *  - while a new query loads, the previous results stay on screen
 *    (`lastData`) instead of flashing an empty table;
 *  - the next page is prefetched, so "Next" is usually instant.
 *
 * This is server data held in Redux on purpose (the project otherwise
 * keeps server state in TanStack Query) — see "Backend API" in CLAUDE.md.
 */

export const PRODUCTS_STALE_MS = 30_000
const MAX_TABS = 10

export interface ProductFilters {
  search: string
  status: ProductStatus | ''
  productType: string
  tag: string
  stock: '' | 'in' | 'out'
  minPrice: string
  maxPrice: string
  sort: ProductSort
  order: 'asc' | 'desc'
  page: number
  pageSize: number
}

export const DEFAULT_FILTERS: ProductFilters = {
  search: '',
  status: '',
  productType: '',
  tag: '',
  stock: '',
  minPrice: '',
  maxPrice: '',
  sort: 'created_at',
  order: 'desc',
  page: 1,
  pageSize: 25,
}

/** Filters → the query parameters the API understands (empty ones omitted). */
export function toParams(filters: ProductFilters): ProductListParams {
  const params: ProductListParams = {
    sort: filters.sort,
    order: filters.order,
    page: filters.page,
    page_size: filters.pageSize,
  }

  const search = filters.search.trim()
  if (search) params.search = search
  if (filters.status) params.status = filters.status
  if (filters.productType) params.product_type = filters.productType
  if (filters.tag) params.tag = filters.tag
  if (filters.stock) params.in_stock = filters.stock === 'in'

  const min = Number.parseFloat(filters.minPrice)
  if (Number.isFinite(min) && min >= 0) params.min_price = min
  const max = Number.parseFloat(filters.maxPrice)
  if (Number.isFinite(max) && max >= 0) params.max_price = max

  return params
}

/** Cache key: two filter sets with the same request share one entry. */
export function cacheKey(filters: ProductFilters): string {
  return JSON.stringify(toParams(filters))
}

/**
 * The query that yields one status tab's count: the same narrowing filters
 * (search, type, ...) with that status, one row per page — only `total`
 * is read. Sort/order are pinned so changing them reuses the cached count.
 */
export function statusCountFilters(
  filters: ProductFilters,
  status: ProductStatus | '',
): ProductFilters {
  return {
    ...filters,
    status,
    page: 1,
    pageSize: 1,
    sort: DEFAULT_FILTERS.sort,
    order: DEFAULT_FILTERS.order,
  }
}

/** True when any narrowing filter (not sort/paging) is applied. */
export function hasActiveFilters(filters: ProductFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.status !== '' ||
    filters.productType !== '' ||
    filters.tag !== '' ||
    filters.stock !== '' ||
    filters.minPrice !== '' ||
    filters.maxPrice !== ''
  )
}

export interface ProductsEntry {
  data: ProductListResponse | null
  error: string | null
  isFetching: boolean
  fetchedAt: number | null
}

export interface ProductsFacets {
  productTypes: string[]
  tags: string[]
}

export interface ProductsState {
  filters: ProductFilters
  entries: Record<string, ProductsEntry>
  /** The most recent results shown, kept on screen while the next query loads. */
  lastData: ProductListResponse | null
  /** Distinct values seen so far — the API has no "list options" endpoint. */
  facets: ProductsFacets
  /** Opened products, shown as tabs above the list/details (oldest first). */
  tabs: ProductTab[]
  /** Product details, cached by id (and "id|raw" for the with-raw-data variant). */
  details: Record<string, ProductDetailsEntry>
}

export interface ProductTab {
  id: string
  /** Not known when a details URL is opened directly; filled in on load. */
  handle: string | null
  title: string | null
}

export interface ProductDetailsEntry {
  data: ProductDetail | null
  error: string | null
  isFetching: boolean
  fetchedAt: number | null
}

type ProductsRootState = { products: ProductsState }

const initialState: ProductsState = {
  filters: DEFAULT_FILTERS,
  entries: {},
  lastData: null,
  facets: { productTypes: [], tags: [] },
  tabs: [],
  details: {},
}

interface FetchArg {
  filters: ProductFilters
  /** Refetch even if the cached page is still fresh. */
  force?: boolean
}

export const fetchProducts = createAsyncThunk<
  { data: ProductListResponse; fetchedAt: number },
  FetchArg,
  { state: ProductsRootState; rejectValue: string }
>(
  'products/fetch',
  async ({ filters }, { rejectWithValue }) => {
    try {
      return { data: await api.products.list(toParams(filters)), fetchedAt: Date.now() }
    } catch (error) {
      return rejectWithValue(toUserMessage(error))
    }
  },
  {
    // Skip if the same page is already in flight, or cached and still fresh.
    condition: ({ filters, force }, { getState }) => {
      const entry = getState().products.entries[cacheKey(filters)]
      if (entry?.isFetching) return false
      const isFresh =
        entry?.data != null &&
        entry.fetchedAt !== null &&
        Date.now() - entry.fetchedAt < PRODUCTS_STALE_MS
      return force || !isFresh
    },
  },
)

/** Cache key for a product's details; the raw-data variant is cached separately. */
export function detailsKey(id: string, raw = false): string {
  return raw ? `${id}|raw` : id
}

interface FetchDetailsArg {
  id: string
  /** Also load Shopify's original payload (only the "Raw data" tab needs it). */
  raw?: boolean
  force?: boolean
}

export const fetchProductDetails = createAsyncThunk<
  { data: ProductDetail; fetchedAt: number },
  FetchDetailsArg,
  { state: ProductsRootState; rejectValue: string }
>(
  'products/fetchDetails',
  async ({ id, raw = false }, { rejectWithValue }) => {
    try {
      return { data: await api.products.details(id, raw), fetchedAt: Date.now() }
    } catch (error) {
      return rejectWithValue(toUserMessage(error))
    }
  },
  {
    condition: ({ id, raw, force }, { getState }) => {
      const entry = getState().products.details[detailsKey(id, raw)]
      if (entry?.isFetching) return false
      const isFresh =
        entry?.data != null &&
        entry.fetchedAt !== null &&
        Date.now() - entry.fetchedAt < PRODUCTS_STALE_MS
      return force || !isFresh
    },
  },
)

function addSorted(list: string[], values: (string | null)[]) {
  let changed = false
  for (const value of values) {
    if (value && !list.includes(value)) {
      list.push(value)
      changed = true
    }
  }
  if (changed) list.sort((a, b) => a.localeCompare(b))
}

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    /**
     * Applies filter/sort/paging changes. Anything other than an explicit
     * page change sends the user back to page 1.
     */
    filtersChanged(state, action: PayloadAction<Partial<ProductFilters>>) {
      const next = { ...state.filters, ...action.payload }
      if (!('page' in action.payload)) next.page = 1
      state.filters = next

      // Cached already? Show it in the same render — no empty flash.
      const cached = state.entries[cacheKey(next)]?.data
      if (cached) state.lastData = cached
    },
    /** "Clear all": drops every narrowing filter, keeps sort and page size. */
    filtersReset(state) {
      const { sort, order, pageSize } = state.filters
      state.filters = { ...DEFAULT_FILTERS, sort, order, pageSize }
      const cached = state.entries[cacheKey(state.filters)]?.data
      if (cached) state.lastData = cached
    },
    /** Opens (or refreshes the label of) a product tab; existing tabs keep their place. */
    tabOpened(
      state,
      action: PayloadAction<{
        id: string
        handle?: string | null
        title?: string | null
      }>,
    ) {
      const { id, handle = null, title = null } = action.payload
      const existing = state.tabs.find((tab) => tab.id === id)
      if (existing) {
        existing.handle ??= handle
        existing.title ??= title
        return
      }
      state.tabs.push({ id, handle, title })
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
      .addCase(fetchProducts.pending, (state, action) => {
        const key = cacheKey(action.meta.arg.filters)
        const entry = state.entries[key]
        state.entries[key] = {
          data: entry?.data ?? null,
          fetchedAt: entry?.fetchedAt ?? null,
          error: null,
          isFetching: true,
        }
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        const key = cacheKey(action.meta.arg.filters)
        const { data, fetchedAt } = action.payload
        state.entries[key] = { data, fetchedAt, error: null, isFetching: false }

        if (key === cacheKey(state.filters)) state.lastData = data
        addSorted(
          state.facets.productTypes,
          data.items.map((item) => item.product_type),
        )
        addSorted(
          state.facets.tags,
          data.items.flatMap((item) => item.tags),
        )
      })
      .addCase(fetchProductDetails.pending, (state, action) => {
        const key = detailsKey(action.meta.arg.id, action.meta.arg.raw)
        const entry = state.details[key]
        state.details[key] = {
          data: entry?.data ?? null,
          fetchedAt: entry?.fetchedAt ?? null,
          error: null,
          isFetching: true,
        }
      })
      .addCase(fetchProductDetails.fulfilled, (state, action) => {
        const { id, raw } = action.meta.arg
        const { data, fetchedAt } = action.payload
        state.details[detailsKey(id, raw)] = {
          data,
          fetchedAt,
          error: null,
          isFetching: false,
        }

        // A tab opened from a bare URL gets its label once the product loads.
        const tab = state.tabs.find((candidate) => candidate.id === id)
        if (tab) {
          tab.handle = data.handle
          tab.title = data.title
        }
      })
      .addCase(fetchProductDetails.rejected, (state, action) => {
        if (action.meta.condition) return
        const key = detailsKey(action.meta.arg.id, action.meta.arg.raw)
        const entry = state.details[key]
        state.details[key] = {
          data: entry?.data ?? null,
          fetchedAt: entry?.fetchedAt ?? null,
          error: action.payload ?? 'Something went wrong. Please try again.',
          isFetching: false,
        }
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        if (action.meta.condition) return
        const key = cacheKey(action.meta.arg.filters)
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

export const { filtersChanged, filtersReset, tabOpened, tabClosed, tabsCleared } =
  productsSlice.actions
export const productsReducer = productsSlice.reducer

/** Warms the cache for whatever filters are currently set (e.g. on app load). */
export const prefetchProducts =
  (): ThunkAction<void, ProductsRootState, unknown, UnknownAction> =>
  (dispatch, getState) => {
    void dispatch(fetchProducts({ filters: getState().products.filters }))
  }
