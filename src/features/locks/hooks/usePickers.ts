import {
  useInfiniteQuery,
  type UseInfiniteQueryResult,
  type InfiniteData,
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
  has_next: boolean
  page: number
  items: T[]
}

/** What a "pick from a long list" box needs from a paged query: the rows so far and a Load more. */
function loadMoreState<T>(query: UseInfiniteQueryResult<InfiniteData<PageOf<T>>>) {
  const pages = query.data?.pages ?? []
  return {
    items: pages.flatMap((page) => page.items),
    /** How many match in all (not just the pages loaded). */
    total: pages[0]?.total ?? 0,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isLoadingMore: query.isFetchingNextPage,
    hasMore: query.hasNextPage,
    loadMore: () => void query.fetchNextPage(),
    error: query.isError && pages.length === 0 ? toUserMessage(query.error) : null,
    retry: () => void query.refetch(),
  }
}

const nextPage = (last: { has_next: boolean; page: number }) =>
  last.has_next ? last.page + 1 : undefined

/**
 * The products to choose from: every product of the store, A–Z, narrowed by what is typed.
 * Asked for when the picker is shown, not before; "Load more" brings the next page.
 */
export function usePickProducts(shop: string, search: string, enabled = true) {
  const text = search.trim()
  const query = useInfiniteQuery({
    queryKey: ['lock-picker', 'products', shop, text],
    queryFn: async ({ pageParam }) => {
      const answer = await api.products.list({
        shop,
        search: text || undefined,
        sort: 'title',
        order: 'asc',
        page: pageParam,
        page_size: 25,
      })
      return { ...answer, items: answer.items satisfies ProductListItem[] }
    },
    initialPageParam: 1,
    getNextPageParam: nextPage,
    enabled: enabled && shop !== '',
    staleTime: STALE_MS,
  })
  return loadMoreState(query)
}

/** The customers to give tags to (every role — the API's own default would hide administrators). */
export function usePickCustomers(shop: string, search: string, enabled = true) {
  const text = search.trim()
  const query = useInfiniteQuery({
    queryKey: ['lock-picker', 'customers', shop, text],
    queryFn: async ({ pageParam }) => {
      const answer = await api.customers.list({
        shop,
        role: 'all',
        search: text || undefined,
        page: pageParam,
        page_size: 25,
      })
      return { ...answer, items: answer.items satisfies CustomerListItem[] }
    },
    initialPageParam: 1,
    getNextPageParam: nextPage,
    enabled: enabled && shop !== '',
    staleTime: STALE_MS,
  })
  return loadMoreState(query)
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
  const query = useInfiniteQuery({
    queryKey: ['access-tags', shop, text, lockOnly],
    queryFn: async ({ pageParam }) => {
      const answer = await api.access.tags({
        shop,
        search: text || undefined,
        lock_only: lockOnly || undefined,
        page: pageParam,
        page_size: 50,
      })
      return { ...answer, items: answer.tags satisfies AccessTag[] }
    },
    initialPageParam: 1,
    getNextPageParam: nextPage,
    enabled: enabled && shop !== '',
    staleTime: STALE_MS,
  })
  return loadMoreState(query)
}
