import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import {
  api,
  type AccessLockBody,
  type AccessTagsUpdateBody,
} from '../../../lib/api/endpoints.ts'

/**
 * After any write the locks, the tag counts and the pickers' rows (a customer's tags changed)
 * are stale. A write is never retried automatically — see lib/api/client.ts.
 */
function useRefreshAfterWrite() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['locks'] }),
      queryClient.invalidateQueries({ queryKey: ['access-tags'] }),
      queryClient.invalidateQueries({ queryKey: ['lock-picker'] }),
    ])
}

/** `POST /access/locks`: lock products, give customers tags, set options — in one call. */
export function useSaveLock() {
  const refresh = useRefreshAfterWrite()
  const mutation = useMutation({
    mutationFn: (body: AccessLockBody) => api.access.lock(body),
    onSuccess: refresh,
  })
  return {
    save: mutation.mutateAsync,
    isSaving: mutation.isPending,
    error: mutation.isError ? toUserMessage(mutation.error) : null,
    clearError: mutation.reset,
  }
}

/** `PUT /access/tags`: add and/or remove tags on products and customers. */
export function useUpdateAccessTags() {
  const refresh = useRefreshAfterWrite()
  const mutation = useMutation({
    mutationFn: (body: AccessTagsUpdateBody) => api.access.updateTags(body),
    onSuccess: refresh,
  })
  return {
    update: mutation.mutateAsync,
    isUpdating: mutation.isPending,
    error: mutation.isError ? toUserMessage(mutation.error) : null,
    clearError: mutation.reset,
  }
}

/** `POST /access/setup`: once per store, creates the definition and pushes pending locks. */
export function useSetupStore() {
  const refresh = useRefreshAfterWrite()
  const mutation = useMutation({
    mutationFn: (shop: string) => api.access.setup(shop),
    onSuccess: refresh,
  })
  return {
    setup: mutation.mutateAsync,
    isSettingUp: mutation.isPending,
    error: mutation.isError ? toUserMessage(mutation.error) : null,
    clearError: mutation.reset,
  }
}

/** `GET /access/check`: asked on demand ("would this customer see this product?"). */
export function useAccessCheck() {
  const mutation = useMutation({
    mutationFn: (params: { shop: string; customer: string; product: string }) =>
      api.access.check(params),
  })
  return {
    check: mutation.mutate,
    result: mutation.data ?? null,
    isChecking: mutation.isPending,
    error: mutation.isError ? toUserMessage(mutation.error) : null,
    reset: mutation.reset,
  }
}
