import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api } from '../../../lib/api/endpoints.ts'

/** How an edit's push to the store is going. */
export type SyncState = 'syncing' | 'synced' | 'failed'

/** How often, and for how long, to ask while a push is still in progress. */
const POLL_MS = 3000
const POLL_FOR_MS = 2 * 60_000

/**
 * The backend reports a push's status as free text. "…fail…" / "…error…" is a
 * failure, "success" / "synced" / "done" / "complete" is finished, and anything
 * else (pending, running, queued) means it is still in progress.
 */
export function classifySync(status: string | null | undefined): SyncState {
  const value = (status ?? '').toLowerCase()
  if (/fail|error/.test(value)) return 'failed'
  if (/success|synced|done|complete|^ok$/.test(value)) return 'synced'
  return 'syncing'
}

interface UseProductSyncOptions {
  /** The status the save itself reported, shown until the first history answer arrives. */
  initialStatus?: string | null
}

/**
 * Tracks a product's latest push to its store after an edit: polls while it is
 * in progress, stops once it finished or failed, and can retry a failed push.
 * Only mounted for products edited in this session, so merely viewing a product
 * costs no extra request (the backend logs every request it receives).
 */
export function useProductSync(
  id: string,
  shop: string | null | undefined,
  { initialStatus }: UseProductSyncOptions = {},
) {
  const queryClient = useQueryClient()
  const [startedAt] = useState(() => Date.now())
  const key = ['product-sync', id, shop ?? null] as const

  const history = useQuery({
    queryKey: key,
    queryFn: () => api.products.syncHistory(id, shop, 1),
    staleTime: 0,
    refetchInterval: (query) => {
      const latest = query.state.data?.[0]
      const state = classifySync(latest?.status ?? initialStatus)
      return state === 'syncing' && Date.now() - startedAt < POLL_FOR_MS ? POLL_MS : false
    },
  })

  const retry = useMutation({
    mutationFn: () => api.products.push(id, shop),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })

  const latest = history.data?.[0] ?? null
  return {
    state: classifySync(latest?.status ?? initialStatus),
    /** The backend's own wording for the push's status. */
    status: latest?.status ?? initialStatus ?? null,
    /** Why the push failed, when it did. */
    failure: latest?.error ?? null,
    retry: () => retry.mutate(),
    isRetrying: retry.isPending,
    retryError: retry.isError ? toUserMessage(retry.error) : null,
  }
}
