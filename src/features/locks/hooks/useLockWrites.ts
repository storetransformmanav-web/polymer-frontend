import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query'
import { useAppDispatch } from '../../../app/store/hooks.ts'
import { productTagsSynced } from '../../../app/store/productsSlice.ts'
import { invalidateAccessQueries } from '../../../lib/accessQueries.ts'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import {
  api,
  type AccessCheck,
  type AccessCustomerTagsBody,
  type AccessLock,
  type AccessLockBody,
  type AccessTagsUpdateBody,
  type LockCustomersBody,
  type LockCustomersResponse,
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
  return () => invalidateAccessQueries(queryClient)
}

/** `POST /access/locks`: lock products, give customers tags, set options — in one call. */
export function useSaveLock() {
  const refresh = useRefreshAfterWrite()
  const dispatch = useAppDispatch()
  const mutation = useMutation({
    mutationFn: (body: AccessLockBody) => api.access.lock(body),
    onSuccess: (_result, body) => {
      // The lock's tags are now on its products: show them in the Products pages too.
      dispatch(
        productTagsSynced({
          refs: body.products ?? [],
          add: body.tags ?? [],
          remove: [],
        }),
      )
      return refresh()
    },
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
  const dispatch = useAppDispatch()
  const refresh = useRefreshAfterWrite()
  const mutation = useMutation({
    mutationFn: (body: AccessTagsUpdateBody) => api.access.updateTags(body),
    onSuccess: (_result, body) => {
      // A key added to / taken from a lock is added to / taken from the product's own tags.
      dispatch(
        productTagsSynced({
          refs: body.products ?? [],
          add: body.tags_add ?? [],
          remove: body.tags_remove ?? [],
        }),
      )
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

/**
 * `PUT /access/locks/{product}/customers`: gives and/or takes customers' access to one locked
 * product (`add` / `remove`, plus `tag` when the lock has several). A removed customer leaves
 * every cached page of the lock's customers at once (the total is corrected); then the lock's
 * customers, the locks (the "with access" figure) and the tag counts are read again quietly.
 * Never retried.
 */
export function useSetLockCustomers() {
  const queryClient = useQueryClient()
  const refresh = useRefreshAfterWrite()
  const mutation = useMutation({
    mutationFn: ({ product, body }: { product: string; body: LockCustomersBody }) =>
      api.access.setLockCustomers(product, body),
    onSuccess: (_result, { product, body }) => {
      const gone = new Set((body.remove ?? []).map((ref) => ref.toLowerCase()))
      if (gone.size > 0) {
        queryClient.setQueriesData<LockCustomersResponse>(
          { queryKey: ['lock-customers', body.shop, product] },
          (data) => {
            if (!data) return data
            const customers = data.customers.filter(
              (customer) =>
                !gone.has((customer.email ?? '').toLowerCase()) &&
                !gone.has(customer.id.toLowerCase()),
            )
            return {
              ...data,
              customers,
              total: Math.max(0, data.total - (data.customers.length - customers.length)),
            }
          },
        )
      }
      return refresh()
    },
  })
  return {
    set: mutation.mutateAsync,
    isSetting: mutation.isPending,
    error: mutation.isError ? toUserMessage(mutation.error) : null,
    clearError: mutation.reset,
  }
}

/**
 * `PUT /access/customers/tags`: adds and/or removes tags on customers (every other tag stays) —
 * how a lock's own tag is given to a customer who already has access through a shared tag (the
 * lock's customers call refuses those). Then every access read is refreshed. Never retried.
 */
export function useSetCustomerTags() {
  const refresh = useRefreshAfterWrite()
  const mutation = useMutation({
    mutationFn: (body: AccessCustomerTagsBody) => api.access.customerTags(body),
    onSuccess: () => refresh(),
  })
  return {
    setTags: mutation.mutateAsync,
    isSetting: mutation.isPending,
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

/** One customer's answer from `GET /access/check`, or why it could not be checked. */
export type AccessCheckOutcome =
  | { ref: string; check: AccessCheck; error: null }
  | { ref: string; check: null; error: string }

/** How many checks run at once when several customers are checked together. */
const CHECKS_AT_ONCE = 4

/**
 * `GET /access/check` for several customers at once, asked on demand ("would these customers see
 * this product?") — one call each, a few at a time, in the order given. One that fails keeps its
 * own message; the others still answer.
 */
export function useAccessChecks() {
  const mutation = useMutation({
    mutationFn: async (params: {
      shop: string
      product: string
      customers: string[]
    }) => {
      const outcomes: AccessCheckOutcome[] = []
      for (let start = 0; start < params.customers.length; start += CHECKS_AT_ONCE) {
        const batch = params.customers.slice(start, start + CHECKS_AT_ONCE)
        outcomes.push(
          ...(await Promise.all(
            batch.map(async (ref): Promise<AccessCheckOutcome> => {
              try {
                const check = await api.access.check({
                  shop: params.shop,
                  customer: ref,
                  product: params.product,
                })
                return { ref, check, error: null }
              } catch (caught) {
                return { ref, check: null, error: toUserMessage(caught) }
              }
            }),
          )),
        )
      }
      return outcomes
    },
  })
  return {
    check: mutation.mutate,
    results: mutation.data ?? null,
    isChecking: mutation.isPending,
    reset: mutation.reset,
  }
}
