import { configureStore } from '@reduxjs/toolkit'
import { SIDEBAR_STORAGE_KEY, THEME_STORAGE_KEY, uiReducer } from './uiSlice.ts'

/**
 * Builds a fresh, fully-configured store (reducers + the localStorage
 * persistence subscription below). The app uses the single `store`
 * instance exported from this file; tests call this factory directly
 * to get an isolated store per test instead of sharing — and having
 * to manually reset — the app's singleton.
 */
export function createAppStore() {
  const appStore = configureStore({
    reducer: {
      ui: uiReducer,
    },
  })

  // Persist the `ui` slice to localStorage whenever it changes — the
  // single place this app writes UI preferences back to storage,
  // mirroring what each hook used to do on its own before this state
  // moved into Redux.
  let previousUi = appStore.getState().ui
  appStore.subscribe(() => {
    const ui = appStore.getState().ui

    if (ui.theme !== previousUi.theme) {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, ui.theme)
      } catch {
        // localStorage unavailable (private browsing, etc.) — the theme
        // still applies for this session via the Redux store.
      }
    }

    if (ui.sidebarCollapsed !== previousUi.sidebarCollapsed) {
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(ui.sidebarCollapsed))
      } catch {
        // localStorage unavailable — collapse state just won't persist.
      }
    }

    previousUi = ui
  })

  return appStore
}

export const store = createAppStore()

export type AppStore = ReturnType<typeof createAppStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
