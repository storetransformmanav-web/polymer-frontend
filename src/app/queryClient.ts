import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '../lib/api/ApiError.ts'

/**
 * Retry a failed query once — but only when trying again could help. A 4xx
 * (no permission, not found, bad filter) gets the same answer every time, and
 * re-asking just adds noise to the server's activity log, so it fails at once.
 * Network drops and 5xx are retried (the API client already retries gateway
 * hiccups itself; this is the last safety net).
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status !== undefined && error.status < 500) {
    return false
  }
  return failureCount < 1
}

/**
 * Single QueryClient for the app. Server-state defaults (staleTime,
 * retry) live here — feature `hooks/use*.ts` files should rely on
 * these rather than overriding them per-query unless there's a
 * specific reason. The whole cache is cleared when the session ends
 * (see `store.ts`).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: shouldRetry,
    },
  },
})
