import { useState } from 'react'
import {
  keepPreviousData,
  useQueries,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import {
  api,
  type AccessTag,
  type CustomerListItem,
  type ProductListItem,
} from '../../../lib/api/endpoints.ts'

const STALE_MS = 30_000

interface PageOf<T> {
  total: number
  total_pages: number
  page: number
  items: T[]
}

/**
 * The page the picker is on. It goes back to the first page whenever what is asked changes (the
 * store, the search text) — the key says which — and keeps the page while only the page moves.
 */
function usePageState(resetKey: string) {
  const [state, setState] = useState({ key: resetKey, page: 1 })
  const page = state.key === resetKey ? state.page : 1
  return [page, (next: number) => setState({ key: resetKey, page: next })] as const
}

/**
 * What a "pick from a long list" box needs from a paged query: the rows of the page on screen and
 * the paging (page, pages, how many match in all). The previous page stays on screen while the
 * next one loads, so the list never blanks out.
 */
function pagedState<T>(
  query: UseQueryResult<PageOf<T>>,
  page: number,
  setPage: (page: number) => void,
  pageSize: number,
) {
  const data = query.data
  return {
    items: data?.items ?? [],
    /** How many match in all (not just this page). */
    total: data?.total ?? 0,
    page,
    pageSize,
    totalPages: Math.max(1, data?.total_pages ?? 1),
    setPage,
    isPending: query.isPending,
    isFetching: query.isFetching,
    error: query.isError && !data ? toUserMessage(query.error) : null,
    retry: () => void query.refetch(),
  }
}

const PRODUCT_PAGE_SIZE = 25
const CUSTOMER_PAGE_SIZE = 25
const TAG_PAGE_SIZE = 50

/**
 * The products to choose from: every product of the store, A–Z, narrowed by what is typed.
 * Asked for when the picker is shown, not before; the paging buttons move between its pages.
 */
export function usePickProducts(shop: string, search: string, enabled = true) {
  const text = search.trim()
  const [page, setPage] = usePageState(`${shop}|${text}`)
  const query = useQuery({
    queryKey: ['lock-picker', 'products', shop, text, page],
    queryFn: async () => {
      const answer = await api.products.list({
        shop,
        search: text || undefined,
        sort: 'title',
        order: 'asc',
        page,
        page_size: PRODUCT_PAGE_SIZE,
      })
      return { ...answer, items: answer.items satisfies ProductListItem[] }
    },
    placeholderData: keepPreviousData,
    enabled: enabled && shop !== '',
    staleTime: STALE_MS,
  })
  return pagedState(query, page, setPage, PRODUCT_PAGE_SIZE)
}

/** The customers to give tags to (every role — the API's own default would hide administrators). */
export function usePickCustomers(shop: string, search: string, enabled = true) {
  const text = search.trim()
  const [page, setPage] = usePageState(`${shop}|${text}`)
  const query = useQuery({
    queryKey: ['lock-picker', 'customers', shop, text, page],
    queryFn: async () => {
      const answer = await api.customers.list({
        shop,
        role: 'all',
        search: text || undefined,
        page,
        page_size: CUSTOMER_PAGE_SIZE,
      })
      return { ...answer, items: answer.items satisfies CustomerListItem[] }
    },
    placeholderData: keepPreviousData,
    enabled: enabled && shop !== '',
    staleTime: STALE_MS,
  })
  return pagedState(query, page, setPage, CUSTOMER_PAGE_SIZE)
}

/**
 * Every tag on the store's products and customers, lock tags first, narrowed by what is
 * typed (a contains-match, done by the backend). Under `['access-tags']`, so a lock write
 * refreshes the counts.
 */
export function useAccessTags(
  shop: string,
  search: string,
  { lockOnly = false, enabled = true }: { lockOnly?: boolean; enabled?: boolean } = {},
) {
  const text = search.trim()
  const [page, setPage] = usePageState(`${shop}|${text}|${lockOnly}`)
  const query = useQuery({
    queryKey: ['access-tags', shop, text, lockOnly, page],
    queryFn: async () => {
      const answer = await api.access.tags({
        shop,
        search: text || undefined,
        lock_only: lockOnly || undefined,
        page,
        page_size: TAG_PAGE_SIZE,
      })
      return { ...answer, items: answer.tags satisfies AccessTag[] }
    },
    placeholderData: keepPreviousData,
    enabled: enabled && shop !== '',
    staleTime: STALE_MS,
  })
  return pagedState(query, page, setPage, TAG_PAGE_SIZE)
}

/** A chosen tag that customers already hold, and how many of them. */
export interface HeldTag {
  tag: string
  customers: number
}

/**
 * How many customers already hold each of these tags (`GET /access/tags?search=<tag>`, the row
 * whose name is exactly the tag). A lock opens its products to **everyone** who holds one of its
 * tags, so a tag that is already in use gives access to all of those customers too — not only the
 * ones picked in the form. Only the tags held by at least one customer are returned.
 */
export function useHeldTags(shop: string, tags: readonly string[]): HeldTag[] {
  const results = useQueries({
    queries: tags.map((tag) => ({
      queryKey: ['access-tags', 'holders', shop, tag.toLowerCase()],
      queryFn: async (): Promise<HeldTag> => {
        const answer = await api.access.tags({ shop, search: tag, page_size: 50 })
        const row = answer.tags.find(
          (item) => item.tag.toLowerCase() === tag.toLowerCase(),
        )
        return { tag, customers: row?.customers ?? 0 }
      },
      enabled: shop !== '' && tag.trim() !== '',
      staleTime: STALE_MS,
    })),
  })
  return results
    .map((result) => result.data)
    .filter((held): held is HeldTag => Boolean(held && held.customers > 0))
}
