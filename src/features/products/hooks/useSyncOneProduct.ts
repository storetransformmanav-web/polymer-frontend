import { useMutation } from '@tanstack/react-query'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api } from '../../../lib/api/endpoints.ts'
import { useRefreshProductList } from './useRefreshProductList.ts'

export interface SyncOneRequest {
  shopifyId: string
  shop: string
  /** Only compare Shopify with the CRM; nothing is saved. */
  dryRun: boolean
}

/**
 * One product synced from Shopify (`POST /sync/products/{shopify_product_id}`). A real sync
 * (not a dry run) refreshes the products list quietly afterwards, so the saved copy shows. A
 * write, so it is never retried.
 */
export function useSyncOneProduct() {
  const refreshList = useRefreshProductList()
  const mutation = useMutation({
    mutationFn: ({ shopifyId, shop, dryRun }: SyncOneRequest) =>
      api.sync.product(shopifyId, shop, dryRun),
    onSuccess: (_result, request) => {
      if (!request.dryRun) refreshList(true)
    },
  })
  return {
    sync: mutation.mutate,
    result: mutation.data ?? null,
    /** What was asked for the result shown (a dry run or a real sync). */
    request: mutation.variables ?? null,
    isSyncing: mutation.isPending,
    error: mutation.isError ? toUserMessage(mutation.error) : null,
    reset: mutation.reset,
  }
}
