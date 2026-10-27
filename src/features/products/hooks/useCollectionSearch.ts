import { useCallback, useEffect, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  api,
  type CollectionListItem,
  type CollectionListResponse,
} from '../../../lib/api/endpoints.ts'

/** How long typing pauses before the search is sent (ms). */
const SEARCH_PAUSE = 250

/** The edit page's dropdown shows one backend page of ten, exactly as the backend sends it. */
const DEFAULT_PAGE_SIZE = 10

const STALE = 60_000

function searchOptions(text: string, shop: string | null | undefined, pageSize: number) {
  return {
    queryKey: ['collections', 'search', shop ?? '', text, pageSize] as const,
    // The backend does the work: it searches, keeps to manual collections (it refuses to put a
    // product in a smart one), orders by title and cuts the page. The answer is shown as it is.
    queryFn: (): Promise<CollectionListResponse> =>
      api.collections.list({
        ...(text ? { search: text } : {}),
        type: 'custom',
        sort: 'title',
        order: 'asc',
        page_size: pageSize,
        ...(shop ? { shop } : {}),
      }),
    staleTime: STALE,
  }
}

interface CollectionSearchOptions {
  /** Also list the collections while nothing is typed (the Add product box, once opened). */
  all?: boolean
  /** Rows asked for (the backend's `page_size`); ten by default. */
  pageSize?: number
}

/**
 * Searches the store's collections on the backend (`GET /collections?search=`) as the user
 * types: by default nothing is asked while the box is empty, the request goes out once typing
 * pauses, and the previous answer stays on screen while the next one loads. With `all` the
 * first page of every collection is listed too while nothing is typed. `loading` is true from
 * the first keystroke until the answer for the text on screen has arrived. `lookup` asks for
 * a text right away (same cache), for Enter pressed before the pause is over.
 */
export function useCollectionSearch(
  text: string,
  shop: string | null | undefined,
  { all = false, pageSize = DEFAULT_PAGE_SIZE }: CollectionSearchOptions = {},
): {
  found: CollectionListItem[]
  total: number
  loading: boolean
  failed: boolean
  lookup: (text: string) => Promise<CollectionListResponse>
} {
  const client = useQueryClient()
  const typed = text.trim()
  const [settled, setSettled] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(typed), typed ? SEARCH_PAUSE : 0)
    return () => window.clearTimeout(timer)
  }, [typed])

  const query = useQuery({
    ...searchOptions(settled, shop, pageSize),
    enabled: settled !== '' || all,
    placeholderData: keepPreviousData,
  })

  const lookup = useCallback(
    (value: string) => client.fetchQuery(searchOptions(value.trim(), shop, pageSize)),
    [client, shop, pageSize],
  )

  if (typed === '' && !all) {
    return { found: [], total: 0, loading: false, failed: false, lookup }
  }
  return {
    found: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    loading: typed !== settled || query.isFetching,
    failed: query.isError && typed === settled,
    lookup,
  }
}
