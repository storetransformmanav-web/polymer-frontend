import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

// Keep in sync with the inline script in index.html, which reads this
// same key to set [data-theme] before first paint (avoids a flash of
// the wrong theme).
export const THEME_STORAGE_KEY = 'polymer-crm:theme'
export const SIDEBAR_STORAGE_KEY = 'polymer-crm:sidebar-collapsed'

export type Theme = 'light' | 'dark' | 'system'

function getStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' || stored === 'system'
      ? stored
      : 'light'
  } catch {
    return 'light'
  }
}

function getStoredSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export interface UiState {
  /** Defaults to 'light' when nothing is stored — doesn't defer to the
   *  OS preference unless the user explicitly picks 'system'. */
  theme: Theme
  sidebarCollapsed: boolean
}

const initialState: UiState = {
  theme: getStoredTheme(),
  sidebarCollapsed: getStoredSidebarCollapsed(),
}

/**
 * App-wide UI state: theme and sidebar-collapsed. These are genuinely
 * global (read by AppBar/UserMenu/Navbar) and persisted, which is why
 * they live in Redux rather than component state — see `store.ts` for
 * the localStorage sync and `src/hooks/useTheme.ts` /
 * `useSidebarCollapsed.ts` for the thin hooks feature code uses
 * instead of importing this slice directly.
 */
const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    themeSet(state, action: PayloadAction<Theme>) {
      state.theme = action.payload
    },
    sidebarCollapsedSet(state, action: PayloadAction<boolean>) {
      state.sidebarCollapsed = action.payload
    },
  },
})

export const { themeSet, sidebarCollapsedSet } = uiSlice.actions
export const uiReducer = uiSlice.reducer
