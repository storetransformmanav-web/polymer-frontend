import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import { api, type AccessTag } from '../../../lib/api/endpoints.ts'

/** The API's largest page of tags. */
const PAGE_SIZE = 200
/** A safety stop: 10 pages is 2,000 tags, far more than a dropdown can use. */
const MAX_PAGES = 10
const FIVE_MINUTES = 5 * 60_000

/** Every tag of one store, read page by page from `GET /access/tags`. */
async function loadAllTags(shop: string): Promise<AccessTag[]> {
  const all: AccessTag[] = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const answer = await api.access.tags({ shop, page, page_size: PAGE_SIZE })
    all.push(...answer.tags)
    if (!answer.has_next) break
  }
  return all
}

interface StoreTagsOptions {
  /** Only ask once this is true (a box focused, a grid opened) — nothing is loaded before. */
  enabled?: boolean
  /** Leave out tags no product carries (customer-only tags): for a filter on products. */
  onProducts?: boolean
}

/**
 * Every tag the stores have, from the tags API — the list the tag boxes and the Tag filter
 * offer. The API says which tags sit on products and customers; the answer is cached for
 * five minutes per store, and a lock write refreshes it (same `['access-tags']` family as the
 * Lock Management page). With several stores their tags are merged. When the call fails (the
 * user may have no right to it) the list is just empty, so callers keep what they already knew.
 */
export function useStoreTags(
  shops: readonly string[],
  { enabled = true, onProducts = false }: StoreTagsOptions = {},
) {
  const keys = useMemo(() => [...new Set(shops.filter(Boolean))], [shops])

  const results = useQueries({
    queries: keys.map((shop) => ({
      queryKey: ['access-tags', 'all', shop],
      queryFn: () => loadAllTags(shop),
      enabled,
      staleTime: FIVE_MINUTES,
      retry: false,
    })),
  })

  // The merged list is rebuilt only when a query's data really changed, so the same array
  // (not a new one each render) reaches the boxes that suggest from it.
  const stamp = results.map((result) => result.dataUpdatedAt).join('|')
  const tags = useMemo(() => {
    const seen = new Map<string, string>()
    for (const result of results) {
      for (const item of result.data ?? []) {
        if (onProducts && item.products <= 0) continue
        if (!seen.has(item.tag.toLowerCase())) seen.set(item.tag.toLowerCase(), item.tag)
      }
    }
    return [...seen.values()]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp, onProducts])

  return { tags, isLoading: results.some((result) => result.isPending && enabled) }
}
