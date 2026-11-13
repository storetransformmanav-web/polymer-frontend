import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { api } from '../../../lib/api/endpoints.ts'

const FIVE_MINUTES = 5 * 60_000
/** The API's largest page of tags; a store is not expected to have more lock keys than a few pages. */
const PAGE_SIZE = 200
const MAX_PAGES = 5

/**
 * The tags of a store that are **lock keys** (`GET /access/tags?lock_only=true`): a customer with
 * one of them can see the locked products that use it. A product's Tags mark these with a small
 * lock, so what Lock Management shows as keys can be told from the product's other tags. Asked for
 * when a product is opened (one small cached read per store), in the `['access-tags']` family, so a
 * lock change in Lock Management — or a tag change here — refreshes it. When the call fails (the
 * user may have no right to it) nothing is marked.
 */
export function useLockKeys(shop: string | null | undefined): ReadonlySet<string> {
  const query = useQuery({
    queryKey: ['access-tags', 'lock-keys', shop],
    enabled: Boolean(shop),
    staleTime: FIVE_MINUTES,
    retry: false,
    queryFn: async () => {
      const keys: string[] = []
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const answer = await api.access.tags({
          shop: shop as string,
          lock_only: true,
          page,
          page_size: PAGE_SIZE,
        })
        keys.push(
          ...answer.tags.filter((item) => item.is_lock_tag).map((item) => item.tag),
        )
        if (!answer.has_next) break
      }
      return keys
    },
  })
  return useMemo(
    () => new Set((query.data ?? []).map((tag) => tag.toLowerCase())),
    [query.data],
  )
}
