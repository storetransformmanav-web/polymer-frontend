import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import {
  api,
  type AccessLock,
  type AccessLockBody,
  type AccessTagsUpdateBody,
} from '../../../lib/api/endpoints.ts'
import { applyTagChange } from '../utils/lockDraft.ts'

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

/** True for a cached lock query (the list or one lock) of this store. */
function isLockQueryOf(shop: string, key: QueryKey): boolean {
  if (key[0] !== 'locks') return false
  if (key[1] === 'one') return key[2] === shop
  return (key[2] as { shop?: string } | undefined)?.shop === shop
}

/**
 * `PUT /access/tags`: adds and/or removes tags on products and customers. Changing a lock's keys
 * sends the product's handle with `tags_add` / `tags_remove`; giving or taking access sends the
 * customers with the lock's keys. When the backend confirms, the keys change in every cached copy
 * of the lock at once (the list row, the lock's page, its tab), then the locks, tag counts and
 * pickers are read again quietly (the "with access" figure comes from that). Never retried.
 */
export function useUpdateAccessTags() {
  const queryClient = useQueryClient()
  const refresh = useRefreshAfterWrite()
  const mutation = useMutation({
    mutationFn: (body: AccessTagsUpdateBody) => api.access.updateTags(body),
    onSuccess: (_result, body) => {
      const handles = new Set((body.products ?? []).map((handle) => handle.toLowerCase()))
      if (handles.size > 0) {
        const patch = (lock: AccessLock): AccessLock =>
          lock.handle && handles.has(lock.handle.toLowerCase())
            ? {
                ...lock,
                tags: applyTagChange(
                  lock.tags,
                  body.tags_add ?? [],
                  body.tags_remove ?? [],
                ),
              }
            : lock
        queryClient.setQueriesData<unknown>(
          { predicate: (query) => isLockQueryOf(body.shop, query.queryKey) },
          (data: unknown) => {
            if (!data || typeof data !== 'object') return data
            if ('locks' in data && Array.isArray((data as { locks: unknown }).locks)) {
              const list = data as { locks: AccessLock[] }
              return { ...list, locks: list.locks.map(patch) }
            }
            return 'tags' in data ? patch(data as AccessLock) : data
          },
        )
      }
      return refresh()
    },
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
