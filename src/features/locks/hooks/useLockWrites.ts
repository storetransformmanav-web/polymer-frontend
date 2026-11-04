import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import {
  api,
  type AccessLock,
  type AccessLockBody,
  type AccessTagsUpdateBody,
} from '../../../lib/api/endpoints.ts'
import { applyTagChange } from '../utils/lockDraft.ts'
import {
  buildOptionsBody,
  withOptionChange,
  type LockOptionChange,
} from '../utils/lockOptions.ts'

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
 * Applies `patch` to the lock with this handle (or product id) in every cached copy of this
 * store's locks — each list page and the lock's own query — and returns what the copies held
 * before, so a refused write can put them back.
 */
function patchLockCaches(
  queryClient: QueryClient,
  shop: string,
  handle: string,
  patch: (lock: AccessLock) => AccessLock,
): [QueryKey, unknown][] {
  const want = handle.toLowerCase()
  const patchRow = (lock: AccessLock): AccessLock =>
    lock.handle?.toLowerCase() === want || lock.product_id.toLowerCase() === want
      ? patch(lock)
      : lock
  const filters = {
    predicate: (query: { queryKey: QueryKey }) => isLockQueryOf(shop, query.queryKey),
  }
  const snapshot = queryClient.getQueriesData<unknown>(filters)
  queryClient.setQueriesData<unknown>(filters, (data: unknown) => {
    if (!data || typeof data !== 'object') return data
    if ('locks' in data && Array.isArray((data as { locks: unknown }).locks)) {
      const list = data as { locks: AccessLock[] }
      return { ...list, locks: list.locks.map(patchRow) }
    }
    return 'tags' in data ? patchRow(data as AccessLock) : data
  })
  return snapshot
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
      for (const handle of body.products ?? []) {
        patchLockCaches(queryClient, body.shop, handle, (lock) => ({
          ...lock,
          tags: applyTagChange(lock.tags, body.tags_add ?? [], body.tags_remove ?? []),
        }))
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

/**
 * Changes a setting of one existing lock — Enabled / Disabled, hidden from menus / lists /
 * sitemaps, no-index, manual locking, or the access-denied message — with `POST /access/locks`
 * (the only call that sets options; `buildOptionsBody`). **The screen changes the moment the
 * change is sent** (the list row, the lock's page and its tab, `patchLockCaches`) and goes back
 * to what it was if the backend refuses; when it confirms, the locks are read again quietly so
 * the Shopify state shows. Never retried.
 */
export function useSaveLockOptions() {
  const queryClient = useQueryClient()
  const refresh = useRefreshAfterWrite()
  const mutation = useMutation({
    mutationFn: (input: { lock: AccessLock; shop: string; change: LockOptionChange }) =>
      api.access.lock(buildOptionsBody(input.lock, input.shop, input.change)),
    onMutate: ({ lock, shop, change }) => ({
      snapshot: patchLockCaches(
        queryClient,
        shop,
        lock.handle ?? lock.product_id,
        (row) => withOptionChange(row, change),
      ),
    }),
    onError: (_error, _input, context) => {
      for (const [key, data] of context?.snapshot ?? [])
        queryClient.setQueryData(key, data)
    },
    onSuccess: refresh,
  })
  return {
    save: mutation.mutateAsync,
    isSaving: mutation.isPending,
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
