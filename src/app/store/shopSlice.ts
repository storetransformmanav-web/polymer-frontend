import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { toUserMessage } from '../../lib/api/ApiError.ts'
import { api, type Shop } from '../../lib/api/endpoints.ts'
import { sessionCleared } from './authSlice.ts'

/**
 * The store ("shop") the whole app is currently scoped to. The backend serves
 * several Shopify stores; the top-bar dropdown picks one, or "all". Pages that
 * support it (products, customers) send the choice as the API's `shop`
 * parameter — they listen for `shopSelected` and reset to page 1.
 *
 * The selection is deliberately *not* persisted: every visit starts on "all".
 */

/** The selection meaning "every store" (also what the API treats an empty `shop` as). */
export const ALL_SHOPS = 'all'

export interface ShopState {
  /** Stores the signed-in user may see, in the backend's dropdown order. */
  items: Shop[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** A shop's `key` (or its domain when it has none), or `ALL_SHOPS`. */
  selected: string
}

const initialState: ShopState = { items: [], status: 'idle', selected: ALL_SHOPS }

type ShopRootState = { shop: ShopState }

/** What the API's `shop=` parameter and the dropdown both call this store. */
export function shopValue(shop: Shop): string {
  return shop.key || shop.domain
}

export function shopLabel(shop: Shop): string {
  return shop.name || shop.key || shop.domain
}

export const fetchShops = createAsyncThunk<
  Shop[],
  void,
  { state: ShopRootState; rejectValue: string }
>(
  'shop/fetch',
  async (_arg, { rejectWithValue }) => {
    try {
      return await api.shops.list()
    } catch (error) {
      return rejectWithValue(toUserMessage(error))
    }
  },
  // Load once; a failed load can be retried, an in-flight or finished one can't.
  {
    condition: (_arg, { getState }) => {
      const { status } = getState().shop
      return status === 'idle' || status === 'error'
    },
  },
)

const shopSlice = createSlice({
  name: 'shop',
  initialState,
  reducers: {
    shopSelected(state, action: PayloadAction<string>) {
      state.selected = action.payload || ALL_SHOPS
    },
  },
  extraReducers: (builder) => {
    builder
      // Signing out forgets the stores (a different user may see different ones).
      .addCase(sessionCleared, () => initialState)
      .addCase(fetchShops.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(fetchShops.fulfilled, (state, action) => {
        state.status = 'ready'
        state.items = action.payload
      })
      .addCase(fetchShops.rejected, (state, action) => {
        if (action.meta.condition) return
        state.status = 'error'
      })
  },
})

export const { shopSelected } = shopSlice.actions
export const shopReducer = shopSlice.reducer
