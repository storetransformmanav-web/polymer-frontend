import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api, type UserItem } from '../../../lib/api/endpoints.ts'

const STALE_MS = 30_000

/** Not under `['users']`: a create or delete re-reads the lists, not every opened user. */
export const userDetailsKey = (id: string) => ['user-details', id] as const

/**
 * One user's full record (`GET /users/{user_id}`), from the TanStack cache.
 *
 * Instant by design: a user seen before (or prefetched by hovering View) is there on the
 * first render, and otherwise `preview` — the matching row of the list already loaded —
 * lets the page draw its header and summary while the rest loads. Cached data older than
 * 30 s is re-read quietly behind what is on screen.
 */
export function useUserDetails(id: string | null, preview: UserItem | null = null) {
  const query = useQuery({
    queryKey: userDetailsKey(id ?? ''),
    queryFn: () => api.users.detail(id ?? ''),
    enabled: Boolean(id),
    staleTime: STALE_MS,
  })

  return {
    user: query.data ?? null,
    preview,
    /** Nothing to show yet (no cache, no request answered). */
    isPending: Boolean(id) && query.isPending,
    /** A quiet re-read behind data that is already on screen. */
    isRefreshing: query.isFetching && Boolean(query.data),
    error: query.isError && !query.data ? toUserMessage(query.error) : null,
    retry: () => void query.refetch(),
  }
}

/** Hovering or focusing View reads the details ahead of the click. */
export function usePrefetchUserDetails() {
  const queryClient = useQueryClient()

  return useCallback(
    (id: string) =>
      void queryClient.prefetchQuery({
        queryKey: userDetailsKey(id),
        queryFn: () => api.users.detail(id),
        staleTime: STALE_MS,
      }),
    [queryClient],
  )
}
