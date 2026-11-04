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
  type InventoryItem,
  type InventoryListParams,
  type InventoryListResponse,
  type InventorySort,
  type InventoryStatus,
  type InventoryTotals,
  type InventoryVariant,
  type StockAdjustBody,
  type StockAdjustment,
  type StockHistoryParams,
  type StockHistoryResponse,
  type StockLine,
  type StockLocation,
  type StockQuantities,
  type StockSetBody,
  type StockWriteResult,
} from '../../lib/api/endpoints.ts'
import {
  applyToLines,
  quantityOf,
  setQuantities,
  setQuantity,
  stockLevel,
  sumLines,
} from '../../lib/inventoryStock.ts'
import { sessionCleared } from './authSlice.ts'

/**
 * Inventory, built for instant-feeling use like the products list:
 *  - every list page, variant and history page is cached by its exact request, so revisiting
 *    one renders at once from memory and is refreshed quietly once it is older than
 *    `INVENTORY_STALE_MS`;
 *  - while a new query loads the previous rows stay on screen (`lastData`);
 *  - **an edit shows at once**: "Set to" / "Adjust by" patch the variant and its list row (and
 *    the figures above the list) the moment they are sent, and put everything back if the
 *    backend refuses; each change is then followed until Shopify confirms it (`trackAdjustment`).
 *
 * Server data held in Redux on purpose, like Products — see "Backend API" in CLAUDE.md.
 */

export const INVENTORY_STALE_MS = 30_000
const MAX_TABS = 10

/** How often, and for how long, a stock change is followed until Shopify has it. */
export const trackingConfig = { intervalMs: 1500, maxMs: 30_000 }

export interface InventoryFilters {
  search: string
  /** A Shopify location id ('' = every location). */
  location: string
  status: InventoryStatus | ''
  productStatus: '' | 'ACTIVE' | 'DRAFT' | 'ARCHIVED'
  /** What counts as "low" ('' = the API's default, 10). */
  lowThreshold: string
  sort: InventorySort
  order: 'asc' | 'desc'
  page: number
  pageSize: number
}

export const DEFAULT_FILTERS: InventoryFilters = {
  search: '',
  location: '',
  status: '',
  productStatus: '',
  lowThreshold: '',
  sort: 'title',
  order: 'asc',
  page: 1,
  pageSize: 25,
}

/** Filters → the query parameters the API understands (empty ones omitted). */
export function toParams(filters: InventoryFilters): InventoryListParams {
  const params: InventoryListParams = {
    sort: filters.sort,
    order: filters.order,
    page: filters.page,
    page_size: filters.pageSize,
  }
  const search = filters.search.trim()
  if (search) params.search = search
  if (filters.location) params.location = filters.location
  if (filters.status) params.status = filters.status
  if (filters.productStatus) params.product_status = filters.productStatus
  const low = Number.parseInt(filters.lowThreshold, 10)
  if (Number.isFinite(low) && low >= 0) params.low_threshold = low
  return params
}

/** Cache key: two filter sets with the same request share one entry. */
export function cacheKey(filters: InventoryFilters): string {
  return JSON.stringify(toParams(filters))
}

/** The key of the narrowing that does not include the stock status (what the status chips count). */
export function baseKey(filters: InventoryFilters): string {
  return JSON.stringify({
    ...toParams(filters),
    status: undefined,
    page: undefined,
    page_size: undefined,
    sort: undefined,
    order: undefined,
  })
}

export function hasActiveFilters(filters: InventoryFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.location !== '' ||
    filters.status !== '' ||
    filters.productStatus !== '' ||
    filters.lowThreshold !== ''
  )
}

export interface Entry<T> {
  data: T | null
  error: string | null
  isFetching: boolean
  fetchedAt: number | null
}

export interface InventoryTab {
  /** The variant's id. */
  id: string
  title: string | null
  variantTitle: string | null
}

/** What was sent: the two kinds of write, with the body each one takes. */
export type StockRequest =
  { mode: 'set'; body: StockSetBody } | { mode: 'adjust'; body: StockAdjustBody }

export interface StockWrite {
  id: string
  /** The variant's id. */
  ref: string
  /** Said in words: "Available at Unit 9: 5 → 22". */
  label: string
  status: 'pending' | 'synced' | 'error'
  error: string | null
  request: StockRequest
  startedAt: number
}

interface Snapshot {
  ref: string
  variant: InventoryVariant | null
  row: Pick<InventoryItem, 'locations' | 'totals'> | null
}

export interface InventoryState {
  filters: InventoryFilters
  entries: Record<string, Entry<InventoryListResponse>>
  lastData: InventoryListResponse | null
  /** The latest figures of the list narrowed the same way but **without** the stock status: what the chips count. */
  baseTotals: { key: string; totals: InventoryTotals } | null
  /** Locations seen in any list answer (the dropdowns are filled from them). */
  locations: StockLocation[]
  tabs: InventoryTab[]
  details: Record<string, Entry<InventoryVariant>>
  history: Record<string, Entry<StockHistoryResponse>>
  /** Stock changes sent this session, by the id Shopify's side gave them. */
  writes: Record<string, StockWrite>
  /** The state before an optimistic edit, by request id, to put it back on a refusal. */
  snapshots: Record<string, Snapshot>
}

type InventoryRootState = { inventory: InventoryState }

const initialState: InventoryState = {
  filters: DEFAULT_FILTERS,
  entries: {},
  lastData: null,
  baseTotals: null,
  locations: [],
  tabs: [],
  details: {},
  history: {},
  writes: {},
  snapshots: {},
}

const isFresh = (entry: Entry<unknown> | undefined) =>
  entry?.data != null &&
  entry.fetchedAt !== null &&
  Date.now() - entry.fetchedAt < INVENTORY_STALE_MS

// --- Requests ----------------------------------------------------------------------------

export const fetchInventory = createAsyncThunk<
  { data: InventoryListResponse; fetchedAt: number },
  { filters: InventoryFilters; force?: boolean },
  { state: InventoryRootState; rejectValue: string }
>(
  'inventory/fetch',
  async ({ filters }, { rejectWithValue }) => {
    try {
      return { data: await api.inventory.list(toParams(filters)), fetchedAt: Date.now() }
    } catch (error) {
      return rejectWithValue(toUserMessage(error))
    }
  },
  {
    condition: ({ filters, force }, { getState }) => {
      const entry = getState().inventory.entries[cacheKey(filters)]
      if (entry?.isFetching) return false
      return force || !isFresh(entry)
    },
  },
)

export const fetchVariantStock = createAsyncThunk<
  { data: InventoryVariant; fetchedAt: number },
  { ref: string; force?: boolean },
  { state: InventoryRootState; rejectValue: string }
>(
  'inventory/fetchVariant',
  async ({ ref }, { rejectWithValue }) => {
    try {
      return { data: await api.inventory.detail(ref), fetchedAt: Date.now() }
    } catch (error) {
      return rejectWithValue(toUserMessage(error))
    }
  },
  {
    condition: ({ ref, force }, { getState }) => {
      const entry = getState().inventory.details[ref]
      if (entry?.isFetching) return false
      return force || !isFresh(entry)
    },
  },
)

/** Cache key of a history request. */
export function historyKey(params: StockHistoryParams): string {
  return JSON.stringify(params)
}

export const fetchStockHistory = createAsyncThunk<
  { data: StockHistoryResponse; fetchedAt: number },
  { params: StockHistoryParams; force?: boolean },
  { state: InventoryRootState; rejectValue: string }
>(
  'inventory/fetchHistory',
  async ({ params }, { rejectWithValue }) => {
    try {
      return { data: await api.inventory.history(params), fetchedAt: Date.now() }
    } catch (error) {
      return rejectWithValue(toUserMessage(error))
    }
  },
  {
    condition: ({ params, force }, { getState }) => {
      const entry = getState().inventory.history[historyKey(params)]
      if (entry?.isFetching) return false
      return force || !isFresh(entry)
    },
  },
)

interface SaveStockArg {
  /** The variant's id. */
  ref: string
  request: StockRequest
  /** The change in words, kept with the write ("Available at Unit 9: 5 → 22"). */
  label: string
}

/**
 * "Set to" / "Adjust by". The variant and its list row show the new numbers **the moment it is
 * sent** (`pending` below); a refusal puts them back. The answer's `adjustments[]` are `pending`
 * until Shopify confirms — follow them with `trackAdjustment`. Never retried automatically.
 */
export const saveStock = createAsyncThunk<
  StockWriteResult,
  SaveStockArg,
  { state: InventoryRootState; rejectValue: string }
>('inventory/save', async ({ ref, request }, { rejectWithValue }) => {
  try {
    return request.mode === 'set'
      ? await api.inventory.set(ref, request.body)
      : await api.inventory.adjust(ref, request.body)
  } catch (error) {
    return rejectWithValue(toUserMessage(error))
  }
})

const tracking = new Set<string>()
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Follows one stock change until Shopify has it (`synced`) or refuses it (`error`): asks every
 * 1–2 seconds, for about 30. It lives in the store, so it carries on after the window is closed.
 * When it ends the variant (and the list) are read again, so the numbers are what Shopify confirmed.
 */
export const trackAdjustment = createAsyncThunk<
  void,
  { id: string },
  { state: InventoryRootState }
>(
  'inventory/track',
  async ({ id }, { dispatch, getState }) => {
    try {
      const started = Date.now()
      while (Date.now() - started < trackingConfig.maxMs) {
        await sleep(trackingConfig.intervalMs)
        let adjustment: StockAdjustment
        try {
          adjustment = await api.inventory.adjustment(id)
        } catch {
          continue // a dropped request: ask again
        }
        dispatch(adjustmentUpdated(adjustment))
        if (adjustment.status === 'pending') continue
        const write = getState().inventory.writes[id]
        if (write) void dispatch(fetchVariantStock({ ref: write.ref, force: true }))
        void dispatch(
          fetchInventory({ filters: getState().inventory.filters, force: true }),
        )
        return
      }
    } finally {
      tracking.delete(id)
    }
  },
  {
    condition: ({ id }) => {
      if (tracking.has(id)) return false
      tracking.add(id)
      return true
    },
  },
)

// --- Instant edits ----------------------------------------------------------------------

type Holder = { locations: StockLine[]; totals: StockQuantities }

/** A variant (or list row) with the request applied — what Shopify will say once it has it. */
export function patchHolder<T extends Holder>(holder: T, request: StockRequest): T {
  const change = (line: StockLine) =>
    request.mode === 'set'
      ? setQuantities(line, request.body.quantities)
      : setQuantity(
          line,
          request.body.name,
          quantityOf(line, request.body.name) + request.body.delta,
        )
  // A row that carries no per-location lines is patched through its totals alone.
  if (holder.locations.length === 0) {
    return { ...holder, totals: change(holder.totals as StockLine) as StockQuantities }
  }
  const locations = applyToLines(holder.locations, request.body.location_id, change)
  return { ...holder, locations, totals: sumLines(locations) }
}

const FIGURES = ['available', 'on_hand', 'committed', 'incoming', 'unavailable'] as const

/** The list's headline figures after one row changed from `before` to `after`. */
function shiftTotals(
  totals: InventoryTotals,
  before: StockQuantities,
  after: StockQuantities,
  threshold: number,
): InventoryTotals {
  const next = { ...totals }
  for (const name of FIGURES) {
    const diff = quantityOf(after, name) - quantityOf(before, name)
    if (diff !== 0 && next[name] != null) next[name] = (next[name] ?? 0) + diff
  }
  const was = stockLevel(before.available, threshold)
  const now = stockLevel(after.available, threshold)
  if (was !== now) {
    const key = { in: 'in_stock', low: 'low_stock', out: 'out_of_stock' } as const
    if (next[key[was]] != null) next[key[was]] = Math.max(0, (next[key[was]] ?? 0) - 1)
    if (next[key[now]] != null) next[key[now]] = (next[key[now]] ?? 0) + 1
  }
  return next
}

function lowThreshold(state: InventoryState): number {
  const value = Number.parseInt(state.filters.lowThreshold, 10)
  return Number.isFinite(value) && value >= 0 ? value : 10
}

/** Shows `request` on the variant's details and on every cached list row of it. */
function applyRequest(state: InventoryState, ref: string, request: StockRequest) {
  const detail = state.details[ref]
  if (detail?.data) detail.data = patchHolder(detail.data, request)

  const threshold = lowThreshold(state)
  let shifted = false
  const patchPage = (page: InventoryListResponse): InventoryListResponse => {
    const row = page.items.find((item) => item.variant_id === ref)
    if (!row) return page
    const after = patchHolder(row, request)
    if (!shifted) {
      shifted = true
      if (state.baseTotals) {
        state.baseTotals.totals = shiftTotals(
          state.baseTotals.totals,
          row.totals,
          after.totals,
          threshold,
        )
      }
    }
    return {
      ...page,
      items: page.items.map((item) => (item.variant_id === ref ? after : item)),
      totals: shiftTotals(page.totals, row.totals, after.totals, threshold),
    }
  }
  for (const entry of Object.values(state.entries)) {
    if (entry.data) entry.data = patchPage(entry.data)
  }
  if (state.lastData) state.lastData = patchPage(state.lastData)
}

/** Puts a variant and its rows back as they were (the backend refused the edit). */
function restoreSnapshot(state: InventoryState, snapshot: Snapshot) {
  const { ref, variant, row } = snapshot
  const detail = state.details[ref]
  if (detail && variant) detail.data = variant
  if (!row) return
  const put = (page: InventoryListResponse): InventoryListResponse => ({
    ...page,
    items: page.items.map((item) =>
      item.variant_id === ref
        ? { ...item, locations: row.locations, totals: row.totals }
        : item,
    ),
  })
  for (const entry of Object.values(state.entries)) {
    if (entry.data) entry.data = put(entry.data)
  }
  if (state.lastData) state.lastData = put(state.lastData)
}

function findRow(state: InventoryState, ref: string): InventoryItem | null {
  for (const entry of Object.values(state.entries)) {
    const row = entry.data?.items.find((item) => item.variant_id === ref)
    if (row) return row
  }
  return state.lastData?.items.find((item) => item.variant_id === ref) ?? null
}

// --- The slice --------------------------------------------------------------------------

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    /** Applies filter/sort/paging changes; anything but an explicit page change goes back to page 1. */
    filtersChanged(state, action: PayloadAction<Partial<InventoryFilters>>) {
      const next = { ...state.filters, ...action.payload }
      if (!('page' in action.payload)) next.page = 1
      state.filters = next
      const cached = state.entries[cacheKey(next)]?.data
      if (cached) state.lastData = cached
    },
    filtersReset(state) {
      const { sort, order, pageSize } = state.filters
      state.filters = { ...DEFAULT_FILTERS, sort, order, pageSize }
      const cached = state.entries[cacheKey(state.filters)]?.data
      if (cached) state.lastData = cached
    },
    /** Opens (or labels) a variant's tab; existing tabs keep their place. */
    tabOpened(
      state,
      action: PayloadAction<{
        id: string
        title?: string | null
        variantTitle?: string | null
      }>,
    ) {
      const { id, title = null, variantTitle = null } = action.payload
      const existing = state.tabs.find((tab) => tab.id === id)
      if (existing) {
        existing.title ??= title
        existing.variantTitle ??= variantTitle
        return
      }
      state.tabs.push({ id, title, variantTitle })
      if (state.tabs.length > MAX_TABS) state.tabs.shift()
    },
    tabClosed(state, action: PayloadAction<string>) {
      state.tabs = state.tabs.filter((tab) => tab.id !== action.payload)
    },
    tabsCleared(state) {
      state.tabs = []
    },
    /** A stock change's state, as the status API reports it. */
    adjustmentUpdated(state, action: PayloadAction<StockAdjustment>) {
      const write = state.writes[action.payload.id]
      if (!write) return
      write.status =
        action.payload.status === 'synced'
          ? 'synced'
          : action.payload.status === 'error'
            ? 'error'
            : 'pending'
      write.error = action.payload.error ?? null
    },
    /** A finished change is cleared from the notices. */
    writeDismissed(state, action: PayloadAction<string>) {
      delete state.writes[action.payload]
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sessionCleared, () => initialState)
      .addCase(fetchInventory.pending, (state, action) => {
        const key = cacheKey(action.meta.arg.filters)
        const entry = state.entries[key]
        state.entries[key] = {
          data: entry?.data ?? null,
          fetchedAt: entry?.fetchedAt ?? null,
          error: null,
          isFetching: true,
        }
      })
      .addCase(fetchInventory.fulfilled, (state, action) => {
        const { filters } = action.meta.arg
        const key = cacheKey(filters)
        const { data, fetchedAt } = action.payload
        state.entries[key] = { data, fetchedAt, error: null, isFetching: false }
        if (key === cacheKey(state.filters)) state.lastData = data
        if (data.locations.length > 0) state.locations = data.locations
        // The figures of a list that has no stock status on it feed the chips' counts.
        if (filters.status === '') {
          state.baseTotals = { key: baseKey(filters), totals: data.totals }
        }
      })
      .addCase(fetchInventory.rejected, (state, action) => {
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
      .addCase(fetchVariantStock.pending, (state, action) => {
        const { ref } = action.meta.arg
        const entry = state.details[ref]
        state.details[ref] = {
          data: entry?.data ?? null,
          fetchedAt: entry?.fetchedAt ?? null,
          error: null,
          isFetching: true,
        }
      })
      .addCase(fetchVariantStock.fulfilled, (state, action) => {
        const { ref } = action.meta.arg
        const { data, fetchedAt } = action.payload
        state.details[ref] = { data, fetchedAt, error: null, isFetching: false }
        const tab = state.tabs.find((candidate) => candidate.id === ref)
        if (tab) {
          tab.title = data.title
          tab.variantTitle = data.variant_title ?? null
        }
      })
      .addCase(fetchVariantStock.rejected, (state, action) => {
        if (action.meta.condition) return
        const { ref } = action.meta.arg
        const entry = state.details[ref]
        state.details[ref] = {
          data: entry?.data ?? null,
          fetchedAt: entry?.fetchedAt ?? null,
          error: action.payload ?? 'Something went wrong. Please try again.',
          isFetching: false,
        }
      })
      .addCase(fetchStockHistory.pending, (state, action) => {
        const key = historyKey(action.meta.arg.params)
        const entry = state.history[key]
        state.history[key] = {
          data: entry?.data ?? null,
          fetchedAt: entry?.fetchedAt ?? null,
          error: null,
          isFetching: true,
        }
      })
      .addCase(fetchStockHistory.fulfilled, (state, action) => {
        const key = historyKey(action.meta.arg.params)
        state.history[key] = {
          data: action.payload.data,
          fetchedAt: action.payload.fetchedAt,
          error: null,
          isFetching: false,
        }
      })
      .addCase(fetchStockHistory.rejected, (state, action) => {
        if (action.meta.condition) return
        const key = historyKey(action.meta.arg.params)
        const entry = state.history[key]
        state.history[key] = {
          data: entry?.data ?? null,
          fetchedAt: entry?.fetchedAt ?? null,
          error: action.payload ?? 'Something went wrong. Please try again.',
          isFetching: false,
        }
      })
      // Instant: the numbers change the moment the change is sent.
      .addCase(saveStock.pending, (state, action) => {
        const { ref, request } = action.meta.arg
        state.snapshots[action.meta.requestId] = {
          ref,
          variant: state.details[ref]?.data ?? null,
          row: (() => {
            const row = findRow(state, ref)
            return row ? { locations: row.locations, totals: row.totals } : null
          })(),
        }
        applyRequest(state, ref, request)
      })
      .addCase(saveStock.fulfilled, (state, action) => {
        const { ref, request, label } = action.meta.arg
        delete state.snapshots[action.meta.requestId]
        for (const adjustment of action.payload.adjustments) {
          state.writes[adjustment.id] = {
            id: adjustment.id,
            ref,
            label,
            status:
              adjustment.status === 'synced'
                ? 'synced'
                : adjustment.status === 'error'
                  ? 'error'
                  : 'pending',
            error: adjustment.error ?? null,
            request,
            startedAt: Date.now(),
          }
        }
      })
      .addCase(saveStock.rejected, (state, action) => {
        const snapshot = state.snapshots[action.meta.requestId]
        if (snapshot) {
          restoreSnapshot(state, snapshot)
          delete state.snapshots[action.meta.requestId]
        }
      })
  },
})

export const {
  filtersChanged,
  filtersReset,
  tabOpened,
  tabClosed,
  tabsCleared,
  adjustmentUpdated,
  writeDismissed,
} = inventorySlice.actions
export const inventoryReducer = inventorySlice.reducer

/** Warms the cache for whatever filters are set (a no-op while a fresh page is held). */
export const prefetchInventory =
  (): ThunkAction<void, InventoryRootState, unknown, UnknownAction> =>
  (dispatch, getState) => {
    void dispatch(fetchInventory({ filters: getState().inventory.filters }))
  }
