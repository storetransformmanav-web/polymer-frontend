import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useState } from 'react'
import { invalidateAccessQueries } from '../../../lib/accessQueries.ts'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import {
  api,
  type AccessLock,
  type AccessLockBody,
  type LockCustomer,
  type LockCustomerSort,
  type LockCustomersParams,
} from '../../../lib/api/endpoints.ts'

/** How many customers one page of the Lock Access tab lists. */
export const LOCK_ACCESS_PAGE_SIZE = 25

/** How many store customers the "Add customers" search shows at a time. */
export const PICK_PAGE_SIZE = 10

/** What is sent to the API for a customer: the email, else the id. */
export const customerRefOf = (customer: LockCustomer) => customer.email ?? customer.id

/** The lock's settings that can be switched on and off from the product page. */
export const LOCK_SWITCHES = [
  'enabled',
  'hide_from_nav',
  'hide_from_lists',
  'hide_from_sitemap',
  'noindex',
  'manual_locking',
] as const
export type LockSwitch = (typeof LOCK_SWITCHES)[number]

const lockKey = (shop: string | undefined, handle: string | null | undefined) =>
  ['locks', 'product', shop, handle] as const

/**
 * The lock of one product, looked up in the store's locks by its handle (there is no single-lock
 * call; the list's search matches handles). `null` once the answer has come back without it: the
 * product is not locked. Shares the `['locks']` key family, so a change made in Lock Management
 * (or here) is read again on both sides.
 */
export function useProductLock(
  shop: string | undefined,
  handle: string | null | undefined,
) {
  const query = useQuery({
    queryKey: lockKey(shop, handle),
    queryFn: async (): Promise<AccessLock | null> => {
      const answer = await api.access.locks({
        shop: shop ?? '',
        search: handle ?? '',
        page_size: 100,
      })
      const wanted = (handle ?? '').toLowerCase()
      return (
        answer.locks.find((lock) => (lock.handle ?? '').toLowerCase() === wanted) ?? null
      )
    },
    enabled: Boolean(shop) && Boolean(handle),
    staleTime: 30_000,
  })
  return {
    lock: query.data ?? null,
    /** The answer has come back and the product has no lock. */
    notLocked: query.isSuccess && query.data === null,
    isPending: query.isPending,
    isFetching: query.isFetching,
    error: query.isError ? toUserMessage(query.error) : null,
    retry: () => void query.refetch(),
  }
}

/**
 * The customers who can open a locked product, with the lock tags each holds — the same
 * `GET /access/locks/{product}/customers` (and the same `['lock-customers', …]` key) as Lock
 * Management's Customer Access tab, so both show one list.
 */
export function useProductLockCustomers(shop: string, product: string) {
  const [search, setSearchState] = useState('')
  const [sort, setSortState] = useState<LockCustomerSort>('name')
  const [page, setPage] = useState(1)
  const params: LockCustomersParams = {
    shop,
    sort,
    page,
    page_size: LOCK_ACCESS_PAGE_SIZE,
    ...(search.trim() ? { search: search.trim() } : {}),
  }
  const query = useQuery({
    queryKey: ['lock-customers', shop, product, params],
    queryFn: () => api.access.lockCustomers(product, params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled: shop !== '' && product !== '',
  })
  return {
    data: query.data ?? null,
    customers: query.data?.customers ?? [],
    tags: query.data?.tags ?? [],
    search,
    sort,
    isPending: query.isPending,
    isFetching: query.isFetching,
    error: query.isError && !query.data ? toUserMessage(query.error) : null,
    retry: () => void query.refetch(),
    setSearch: (value: string) => {
      setSearchState(value)
      setPage(1)
    },
    setSort: (value: LockCustomerSort) => {
      setSortState(value)
      setPage(1)
    },
    setPage,
  }
}

/**
 * The store's customers for the "Add customers" window (`GET /customers?role=all&search=&shop=`),
 * asked only once something is typed. Under `['lock-picker']`, so an access change re-reads it.
 */
export function usePickStoreCustomers(shop: string, search: string, page: number) {
  const text = search.trim()
  const query = useQuery({
    queryKey: ['lock-picker', 'product-customers', shop, text, page],
    queryFn: () =>
      api.customers.list({
        role: 'all',
        shop,
        search: text,
        page,
        page_size: PICK_PAGE_SIZE,
      }),
    enabled: shop !== '' && text !== '',
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
  return {
    items: text ? (query.data?.items ?? []) : [],
    total: text ? (query.data?.total ?? 0) : 0,
    totalPages: query.data?.total_pages ?? 1,
    isFetching: query.isFetching,
    error: query.isError ? toUserMessage(query.error) : null,
  }
}

export type LockAccessChange =
  /** Give customers one tag (a tag the product doesn't have yet becomes one of its keys first). */
  | { kind: 'give'; refs: string[]; tag: string }
  /** Take one tag away from one customer. */
  | { kind: 'take'; customer: LockCustomer; tag: string }
  /** Take every key of this product away from these customers. */
  | { kind: 'remove'; refs: string[] }
  /** Switch one of the lock's settings on or off. */
  | { kind: 'switch'; name: LockSwitch; value: boolean }
  /** Add a key (tag) to the product: customers with it can then open it. */
  | { kind: 'addKey'; tag: string }
  /** Lock a product that is not locked yet (no tags = any signed-in customer). */
  | { kind: 'lock'; tags: string[] }
  /** Take the lock off: everyone can see the product again. */
  | { kind: 'unlock' }

/**
 * Every write of the Lock Access tab, on the access API (never retried):
 * - **give a tag** — `PUT /access/locks/{product}/customers` `{ add, tag }`; a tag the product
 *   does not have yet is first added as a key with `POST /access/locks` `{ products, tags }`
 *   (the lock's own keys and the new one), since a customer's tag only opens a product that has it.
 * - **take one tag** — `PUT /access/customers/tags` `{ customers, tags_remove }`; when it is the
 *   only key of this product they hold, `PUT …/customers` `{ remove }` (the documented way).
 * - **remove customers** — `PUT …/customers` `{ remove }`.
 * - **settings / Enabled** — `POST /access/locks` with the product, its keys (a product sent
 *   without tags is made login-only) and only the setting that changes.
 * - **lock** — `POST /access/locks` `{ products, tags?, enabled: true }`; **unlock** —
 *   `DELETE /access/locks/{product}`.
 * A setting shows at once from the answer; afterwards every access read (locks, tags, pickers,
 * lock customers) is marked stale, so Lock Management shows the change too.
 */
export function useProductLockWrites(
  shop: string,
  handle: string,
  lock: AccessLock | null,
) {
  const queryClient = useQueryClient()
  const product = lock ? (lock.handle ?? lock.product_id) : handle
  const keys = lock?.tags ?? []
  const isKey = (tag: string) =>
    keys.some((key) => key.toLowerCase() === tag.trim().toLowerCase())
  const withKeys = (): Pick<AccessLockBody, 'tags'> =>
    keys.length > 0 ? { tags: keys } : {}

  const mutation = useMutation({
    mutationFn: async (change: LockAccessChange): Promise<string> => {
      switch (change.kind) {
        case 'give': {
          const tag = change.tag.trim()
          const isNew = !isKey(tag)
          if (isNew) {
            await api.access.lock({ shop, products: [product], tags: [...keys, tag] })
          }
          const result = await api.access.setLockCustomers(product, {
            shop,
            add: change.refs,
            // The API needs the tag only when the lock has several keys.
            ...(keys.length + (isNew ? 1 : 0) > 1 ? { tag } : {}),
          })
          return result.message
        }
        case 'take': {
          const held = change.customer.tags.filter(isKey)
          if (held.length <= 1) {
            const result = await api.access.setLockCustomers(product, {
              shop,
              remove: [customerRefOf(change.customer)],
            })
            return result.message
          }
          const result = await api.access.customerTags({
            shop,
            customers: [customerRefOf(change.customer)],
            tags_remove: [change.tag],
          })
          return result.message
        }
        case 'remove': {
          const result = await api.access.setLockCustomers(product, {
            shop,
            remove: change.refs,
          })
          return result.message
        }
        case 'switch': {
          const result = await api.access.lock({
            shop,
            products: [product],
            ...withKeys(),
            [change.name]: change.value,
          })
          return result.message
        }
        case 'addKey': {
          const result = await api.access.lock({
            shop,
            products: [product],
            tags: [...keys, change.tag.trim()],
          })
          return result.message
        }
        case 'lock': {
          const result = await api.access.lock({
            shop,
            products: [handle],
            ...(change.tags.length > 0 ? { tags: change.tags } : {}),
            enabled: true,
          })
          return result.message
        }
        case 'unlock': {
          const result = await api.access.removeLock(product, shop)
          return result.message
        }
      }
    },
    onSuccess: (_message, change) => {
      // A setting shows at once (the re-read below confirms it).
      if (change.kind === 'switch') {
        queryClient.setQueryData<AccessLock | null>(lockKey(shop, handle), (current) =>
          current ? { ...current, [change.name]: change.value } : current,
        )
      }
      if (change.kind === 'unlock') {
        queryClient.setQueryData<AccessLock | null>(lockKey(shop, handle), null)
      }
      return invalidateAccessQueries(queryClient)
    },
  })

  return {
    write: mutation.mutateAsync,
    isWriting: mutation.isPending,
  }
}
