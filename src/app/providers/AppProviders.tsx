import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Provider as ReduxProvider } from 'react-redux'
import { env } from '../../config/env.ts'
import { useDevToolsGuard } from '../../hooks/useDevToolsGuard.ts'
import { queryClient } from '../queryClient.ts'
import { store } from '../store/store.ts'

/**
 * Composes all app-wide context providers in one place (Redux,
 * TanStack Query, auth once it exists, ...) so `App.tsx` doesn't
 * accumulate provider nesting as the app grows.
 *
 * Theme and sidebar-collapsed state live in the Redux store (see
 * `app/store/uiSlice.ts`); orders/products server state is cached by
 * React Query (its devtools panel is dev-only — tree-shaken out of
 * the production build). Add the next global provider (e.g. an auth
 * session) here too, not in `App.tsx` or `main.tsx`.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  // Right-click menu and developer-tools shortcuts off (production builds; see config/env.ts).
  useDevToolsGuard(env.blockDevTools)

  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        {children}
        {env.isDev && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ReduxProvider>
  )
}
