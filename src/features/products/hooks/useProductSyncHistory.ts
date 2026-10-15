import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api } from '../../../lib/api/endpoints.ts'
import { classifySync } from '../utils/sync.ts'

/** Only the latest push is needed: it tells whether an edit reached the store. */
const LATEST_PUSH_ONLY = 1

/** Matches every history query of one product (any store) — for invalidating after a change. */
export const productSyncPrefix = (id: string) => ['product-sync', id] as const

export const productSyncKey = (id: string, shop: string | null | undefined) =>
  [...productSyncPrefix(id), shop ?? null] as const

/** How often, and for how long after a push started, to ask while it is still in progress. */
const POLL_MS = 3000
const POLL_FOR_MS = 2 * 60_000

interface Options {
  /** Wait until the product's store is known (it is sent as `shop=`). */
  enabled?: boolean
  /** The status a just-saved edit reported, before the history shows that push. */
  initialStatus?: string | null
}

/**
 * A product's recent pushes to its store (`GET /products/{id}/sync`), newest
 * first. TanStack Query caches it per product and store, so reopening a product
 * shows it at once while a fresh copy loads quietly. While the latest push is
 * still in progress it asks again every few seconds, so the page follows it to
 * the end without a reload. The status badge in the header and the history
 * section below the details read this same query: one request, one cache.
 */
export function useProductSyncHistory(
  id: string,
  shop: string | null | undefined,
  { enabled = true, initialStatus = null }: Options = {},
) {
  const [startedAt] = useState(() => Date.now())

  const query = useQuery({
    queryKey: productSyncKey(id, shop),
    queryFn: () => api.products.syncHistory(id, shop, LATEST_PUSH_ONLY),
    enabled,
    staleTime: 30_000,
    refetchInterval: (current) => {
      const latest = current.state.data?.[0]
      if (!latest) {
        const waiting =
          classifySync(initialStatus) === 'syncing' && initialStatus !== null
        return waiting && Date.now() - startedAt < POLL_FOR_MS ? POLL_MS : false
      }
      if (classifySync(latest.status) !== 'syncing') return false
      // A push that has been "pending" for ages is stuck, not in progress: stop asking.
      return Date.now() - Date.parse(latest.created_at) < POLL_FOR_MS ? POLL_MS : false
    },
  })

  return {
    items: query.data ?? [],
    /** Nothing to show yet (the first load). */
    isPending: query.isPending && query.fetchStatus !== 'idle',
    /** A (re)load is running — also true for the quiet refresh behind cached data. */
    isFetching: query.isFetching,
    error: query.isError && !query.data ? toUserMessage(query.error) : null,
    /** Asks the backend again now. */
    refresh: () => void query.refetch(),
  }
}
