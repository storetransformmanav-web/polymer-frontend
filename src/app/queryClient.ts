import { QueryClient } from '@tanstack/react-query'

/**
 * Single QueryClient for the app. Server-state defaults (staleTime,
 * retry) live here — feature `hooks/use*.ts` files should rely on
 * these rather than overriding them per-query unless there's a
 * specific reason.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
})
