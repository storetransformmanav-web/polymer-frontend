import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api } from '../../../lib/api/endpoints.ts'
import { classifySync } from '../utils/sync.ts'
import { productSyncPrefix, useProductSyncHistory } from './useProductSyncHistory.ts'

interface UseProductSyncOptions {
  /** The status the save itself reported, shown until the first history answer arrives. */
  initialStatus?: string | null
}

/**
 * Tracks a product's latest push to its store after an edit: it reads the
 * shared push history (which polls while a push is in progress and stops once
 * it finished or failed) and can retry a failed push.
 */
export function useProductSync(
  id: string,
  shop: string | null | undefined,
  { initialStatus }: UseProductSyncOptions = {},
) {
  const queryClient = useQueryClient()
  const history = useProductSyncHistory(id, shop, { initialStatus })

  const retry = useMutation({
    mutationFn: () => api.products.push(id, shop),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productSyncPrefix(id) }),
  })

  const latest = history.items[0] ?? null
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
