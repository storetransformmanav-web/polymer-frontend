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
  type ProductCreateBody,
  type ProductCreateResult,
  type ProductListItem,
  type ProductListParams,
  type ProductMediaInput,
  type ProductListResponse,
  type ProductSort,
  type ProductStatus,
  type ProductUpdateBody,
  type ProductWriteResult,
} from '../../lib/api/endpoints.ts'
import { sessionCleared } from './authSlice.ts'
import {
  hideRemovedImages,
  patchDetail,
  patchListItem,
  type RemovedImage,
} from './productPatch.ts'
import { ALL_SHOPS, shopSelected } from './shopSlice.ts'

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
  /** The store picked in the top bar ('' = all). Set by `shopSelected`, not by this page's toolbar. */
  shop: string
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
  shop: '',
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
  if (filters.shop) params.shop = filters.shop
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
  /**
   * Files added to a product by address that the store hasn't finished downloading
   * (so the product has no copy of them yet), by product id. Kept here rather than in
   * the Media tab so they stay on screen when the tab or product is left and come back.
   */
  pendingMedia: Record<string, PendingMedia>
  /**
   * Images just deleted, by product id. The store only *queues* a delete, so the next
   * read of the product can still list them; they stay hidden until it stops doing so.
   */
  removedMedia: Record<string, RemovedImage[]>
}

export interface PendingMedia {
  items: ProductMediaInput[]
  /** How many images the product had when they were added. */
  baseline: number
  startedAt: number
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
  pendingMedia: {},
  removedMedia: {},
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

interface UpdateProductArg {
  id: string
  body: ProductUpdateBody
  /** The product's store key (sent as `shop=`), when it has one. */
  shop?: string | null
}

/**
 * Saves an edit. On success the cached copies of the product are patched at
 * once (see the `fulfilled` case below), so nothing waits on a refetch. A
 * write is never retried automatically — a repeat could apply twice.
 */
export const updateProduct = createAsyncThunk<
  ProductWriteResult,
  UpdateProductArg,
  { state: ProductsRootState; rejectValue: string }
>('products/update', async ({ id, body, shop }, { rejectWithValue }) => {
  try {
    return await api.products.update(id, body, shop)
  } catch (error) {
    return rejectWithValue(toUserMessage(error))
  }
})

interface DeleteProductArg {
  id: string
  /** The product's store key (sent as `shop=`), when it has one. */
  shop?: string | null
}

/**
 * Deletes a product the way the backend does by default — it archives it. On
 * success the cached copies show it as Archived at once, so nothing waits on a
 * refetch. Never retried automatically.
 */
export const deleteProduct = createAsyncThunk<
  ProductWriteResult,
  DeleteProductArg,
  { state: ProductsRootState; rejectValue: string }
>('products/delete', async ({ id, shop }, { rejectWithValue }) => {
  try {
    return await api.products.remove(id, shop)
  } catch (error) {
    return rejectWithValue(toUserMessage(error))
  }
})

/**
 * Creates a product. Nothing is cached here: the caller turns the answer into a
 * list row and dispatches `productCreated`, so the new product shows at the top
 * of the list at once (it is not retried — a repeat could create it twice).
 */
export const createProduct = createAsyncThunk<
  ProductCreateResult,
  { body: ProductCreateBody },
  { state: ProductsRootState; rejectValue: string }
>('products/create', async ({ body }, { rejectWithValue }) => {
  try {
    return await api.products.create(body)
  } catch (error) {
    return rejectWithValue(toUserMessage(error))
  }
})

/**
 * Puts a just-created product into the cached lists, where it belongs, so it is
 * on screen straight away: at the top of the page being shown (when that page is
 * a plain first page that the product matches) and in every status tab's count.
 * Every cached query is marked stale so each refreshes quietly.
 */
function insertCreatedProduct(state: ProductsState, item: ProductListItem) {
  const status = (item.status ?? '').toUpperCase()
  const shopKey = item.shop?.key ?? ''
  const f = state.filters

  const matchesShop = !f.shop || f.shop === shopKey || f.shop === item.shop?.domain
  const matchesStatus = !f.status || f.status === status
  const plainFirstPage =
    f.page === 1 &&
    !f.search.trim() &&
    !f.productType &&
    !f.tag &&
    !f.stock &&
    !f.minPrice &&
    !f.maxPrice
  // Newest first is where a new product belongs; other orders wait for the refetch.
  const newestFirst = f.sort === 'created_at' && f.order === 'desc'

  const current = state.entries[cacheKey(f)]
  if (current?.data && matchesShop && matchesStatus && plainFirstPage && newestFirst) {
    const items = [item, ...current.data.items.filter((row) => row.id !== item.id)]
    current.data = {
      ...current.data,
      items: items.slice(0, f.pageSize),
      total: current.data.total + 1,
      total_pages: Math.max(1, Math.ceil((current.data.total + 1) / f.pageSize)),
    }
    if (state.lastData) state.lastData = current.data
  }

  // The status tabs' counts (one-row queries) grow by one where the product counts.
  for (const [key, entry] of Object.entries(state.entries)) {
    if (!entry.data) continue
    let params: ProductListParams
    try {
      params = JSON.parse(key) as ProductListParams
    } catch {
      continue
    }
    const narrowed =
      params.search ||
      params.product_type ||
      params.tag ||
      params.min_price !== undefined ||
      params.max_price !== undefined ||
      params.in_stock !== undefined
    if (params.page_size !== 1 || params.page !== 1 || narrowed) continue
    if (params.shop && params.shop !== shopKey && params.shop !== item.shop?.domain)
      continue
    if (params.status && params.status !== status) continue
    entry.data = { ...entry.data, total: entry.data.total + 1 }
  }

  for (const entry of Object.values(state.entries)) entry.fetchedAt = null
  addSorted(state.facets.productTypes, [item.product_type])
  addSorted(state.facets.tags, item.tags)
}

interface AddMediaArg {
  id: string
  items: ProductMediaInput[]
  /** The product's store key (sent as `shop=`). */
  shop?: string | null
}

/**
 * Attaches media by URL. The store downloads the files first, so there is
 * nothing to show in the product yet — the cached copies are only marked stale
 * (the caller then refreshes them, and shows the files as "processing" until
 * they arrive). Never retried automatically.
 */
export const addProductMedia = createAsyncThunk<
  ProductWriteResult,
  AddMediaArg,
  { state: ProductsRootState; rejectValue: string }
>('products/addMedia', async ({ id, items, shop }, { rejectWithValue }) => {
  try {
    return await api.products.addMedia(id, items, shop)
  } catch (error) {
    return rejectWithValue(toUserMessage(error))
  }
})

interface RemoveMediaArg {
  id: string
  /** The CRM id of the media attachment (an image's `id`). */
  attachmentId: string
  shop?: string | null
}

/**
 * Removes one media attachment. On success it disappears from every cached copy
 * of the product at once (details, so the Media tab, the gallery and the counts
 * all update with no loader). Never retried automatically.
 */
export const removeProductMedia = createAsyncThunk<
  ProductWriteResult,
  RemoveMediaArg,
  { state: ProductsRootState; rejectValue: string }
>('products/removeMedia', async ({ id, attachmentId, shop }, { rejectWithValue }) => {
  try {
    return await api.products.removeMedia(id, attachmentId, shop)
  } catch (error) {
    return rejectWithValue(toUserMessage(error))
  }
})

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

/**
 * Shows a saved change to a product everywhere at once, and marks every cached
 * copy stale so each refreshes quietly (old values stay on screen meanwhile).
 */
function patchCachedProduct(state: ProductsState, id: string, body: ProductUpdateBody) {
  for (const key of [detailsKey(id), detailsKey(id, true)]) {
    const entry = state.details[key]
    if (!entry?.data) continue
    entry.data = patchDetail(entry.data, body)
    entry.fetchedAt = null
  }

  for (const entry of Object.values(state.entries)) {
    if (entry.data?.items.some((item) => item.id === id)) {
      entry.data = {
        ...entry.data,
        items: entry.data.items.map((item) =>
          item.id === id ? patchListItem(item, body) : item,
        ),
      }
    }
    // Titles, statuses and prices can move a product between filters and counts.
    entry.fetchedAt = null
  }

  if (state.lastData?.items.some((item) => item.id === id)) {
    state.lastData = {
      ...state.lastData,
      items: state.lastData.items.map((item) =>
        item.id === id ? patchListItem(item, body) : item,
      ),
    }
  }

  const tab = state.tabs.find((candidate) => candidate.id === id)
  if (tab) {
    tab.title = body.title ?? tab.title
    tab.handle = body.handle ?? tab.handle
  }
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
    /** A product was created: show it in the cached lists at once. */
    productCreated(state, action: PayloadAction<ProductListItem>) {
      insertCreatedProduct(state, action.payload)
    },
    /** "Clear all": drops every narrowing filter, keeps sort and page size. */
    filtersReset(state) {
      // The top-bar store isn't one of this page's filters, so it survives "Clear all".
      const { sort, order, pageSize, shop } = state.filters
      state.filters = { ...DEFAULT_FILTERS, sort, order, pageSize, shop }
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
    /** Files were sent to the store and are not in the product yet. */
    mediaQueued(
      state,
      action: PayloadAction<{
        id: string
        items: ProductMediaInput[]
        baseline: number
        startedAt: number
      }>,
    ) {
      const { id, items, baseline, startedAt } = action.payload
      const existing = state.pendingMedia[id]
      // More added while some are still waiting: they wait together, from the older baseline.
      state.pendingMedia[id] = existing
        ? { ...existing, items: [...existing.items, ...items] }
        : { items, baseline, startedAt }
    },
    /** Nothing is waiting any more for this product (it all arrived, or it was dismissed). */
    mediaSettled(state, action: PayloadAction<string>) {
      delete state.pendingMedia[action.payload]
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
        const cached = state.entries[cacheKey(next)]?.data
        if (cached) state.lastData = cached
      })
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
        const { fetchedAt } = action.payload
        // A just-deleted image the backend still lists stays hidden.
        const removed = state.removedMedia[action.payload.data.id]
        let data = action.payload.data
        if (removed) {
          const hidden = hideRemovedImages(data.images, removed, Date.now())
          if (hidden.stillListed.length > 0) {
            state.removedMedia[data.id] = hidden.stillListed
            data = { ...data, images: hidden.images }
          } else {
            delete state.removedMedia[data.id]
          }
        }
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
      // A saved edit: show it everywhere at once, and mark every cached copy
      // stale so each refreshes quietly (old values stay on screen meanwhile).
      .addCase(updateProduct.fulfilled, (state, action) => {
        patchCachedProduct(state, action.meta.arg.id, action.meta.arg.body)
      })
      .addCase(deleteProduct.fulfilled, (state, action) => {
        patchCachedProduct(state, action.meta.arg.id, { status: 'ARCHIVED' })
      })
      .addCase(addProductMedia.fulfilled, (state, action) => {
        patchCachedProduct(state, action.meta.arg.id, {})
      })
      .addCase(removeProductMedia.fulfilled, (state, action) => {
        const { id, attachmentId } = action.meta.arg
        const image = [state.details[detailsKey(id)], state.details[detailsKey(id, true)]]
          .flatMap((entry) => entry?.data?.images ?? [])
          .find((candidate) => candidate.id === attachmentId)
        if (image) {
          state.removedMedia[id] = [
            ...(state.removedMedia[id] ?? []),
            { id: attachmentId, url: image.url, at: Date.now() },
          ]
        }
        patchCachedProduct(state, id, { media_remove: [attachmentId] })
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

export const {
  filtersChanged,
  filtersReset,
  productCreated,
  tabOpened,
  tabClosed,
  tabsCleared,
  mediaQueued,
  mediaSettled,
} = productsSlice.actions
export const productsReducer = productsSlice.reducer

/** Warms the cache for whatever filters are currently set (e.g. on app load). */
export const prefetchProducts =
  (): ThunkAction<void, ProductsRootState, unknown, UnknownAction> =>
  (dispatch, getState) => {
    void dispatch(fetchProducts({ filters: getState().products.filters }))
  }
