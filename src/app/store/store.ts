import { configureStore } from '@reduxjs/toolkit'
import { setAccessToken, setUnauthorizedHandler } from '../../lib/api/client.ts'
import { authReducer, sessionCleared, SESSION_STORAGE_KEY } from './authSlice.ts'
import { customersReducer } from './customersSlice.ts'
import { productsReducer } from './productsSlice.ts'
import { shopReducer } from './shopSlice.ts'
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
      auth: authReducer,
      products: productsReducer,
      customers: customersReducer,
      shop: shopReducer,
    },
  })

  // Persist the `ui` slice to localStorage whenever it changes — the
  // single place this app writes UI preferences back to storage,
  // mirroring what each hook used to do on its own before this state
  // moved into Redux. The auth session is persisted the same way, and
  // its token is mirrored into apiClient for the Authorization header.
  let previousUi = appStore.getState().ui
  let previousSession = appStore.getState().auth.session
  setAccessToken(previousSession?.accessToken ?? null)
  // A 401 on an authenticated request means the token expired or was revoked.
  setUnauthorizedHandler(() => appStore.dispatch(sessionCleared('expired')))

  appStore.subscribe(() => {
    const { ui, auth } = appStore.getState()

    if (auth.session !== previousSession) {
      previousSession = auth.session
      setAccessToken(auth.session?.accessToken ?? null)
      try {
        if (auth.session) {
          window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(auth.session))
        } else {
          window.localStorage.removeItem(SESSION_STORAGE_KEY)
        }
      } catch {
        // localStorage unavailable — the session just won't survive a reload.
      }
    }

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
