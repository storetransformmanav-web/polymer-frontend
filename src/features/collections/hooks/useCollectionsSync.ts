import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { ALL_SHOPS, shopLabel, shopValue } from '../../../app/store/shopSlice.ts'
import { useShops } from '../../../hooks/useShops.ts'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api, type CollectionSyncResult } from '../../../lib/api/endpoints.ts'
import { ROOT } from './useCollections.ts'

/** How long the result (or the error) stays beside the button before it goes away. */
const SHOW_RESULT_MS = 20_000

/** What the last sync did, for the pill beside the button. */
export interface CollectionsSyncOutcome {
  /** The backend's own words ("Collections synced from Shopify"). */
  message: string
  /** One entry per store that answered. */
  results: CollectionSyncResult[]
  /** The refusal of a store that could not be synced (the stores after it were not tried). */
  failure: string | null
  /** The run copied every collection's products again (the repair). */
  allProducts: boolean
}

/**
 * Syncing the collections of a store from Shopify (`POST /sync/collections?all_products=`). The
 * backend answers when it is done — with what it did per store — so there is nothing to follow:
 * the collections lists are re-read as soon as it answers. With "All shops" selected every
 * connected, active store is synced, one after the other; with one store selected, just that one.
 * Never retried (a repeat would start a second run). The result stays beside the button for a
 * while.
 */
export function useCollectionsSync() {
  const { shops, selected, status: shopsStatus } = useShops()
  const queryClient = useQueryClient()
  const [outcome, setOutcome] = useState<CollectionsSyncOutcome | null>(null)

  const targets = useMemo(() => {
    if (selected === ALL_SHOPS) {
      return shops.filter((shop) => shop.connected && shop.is_active)
    }
    return shops.filter((shop) => shopValue(shop) === selected)
  }, [shops, selected])

  const mutation = useMutation({
    mutationFn: async ({
      keys,
      allProducts,
    }: {
      keys: string[]
      allProducts: boolean
    }) => {
      const results: CollectionSyncResult[] = []
      let message = ''
      let failure: string | null = null
      // One store after another: a failure stops there but keeps what the earlier ones did.
      for (const key of keys) {
        try {
          const answer = await api.sync.triggerCollections({ shop: key, allProducts })
          message = answer.message || message
          results.push(...answer.results)
        } catch (error) {
          failure = toUserMessage(error)
          break
        }
      }
      return { message, results, failure, allProducts } satisfies CollectionsSyncOutcome
    },
    onMutate: () => setOutcome(null),
    onSuccess: (result) => {
      setOutcome(result)
      // What the store reports is already saved: read the lists again (the old ones stay until then).
      if (result.results.length > 0) {
        void queryClient.invalidateQueries({ queryKey: [ROOT] })
      }
    },
  })

  useEffect(() => {
    if (!outcome) return undefined
    const timer = window.setTimeout(() => setOutcome(null), SHOW_RESULT_MS)
    return () => window.clearTimeout(timer)
  }, [outcome])

  return {
    /** The stores that would be synced now (the selected one, or every visible store). */
    targets: targets.map((shop) => ({ key: shopValue(shop), label: shopLabel(shop) })),
    /** The store list has loaded (so there is something to sync). */
    ready: shopsStatus === 'ready' && targets.length > 0,
    isSyncing: mutation.isPending,
    outcome,
    /** `allProducts` = copy the products of every collection again (first run / repair). */
    start: (allProducts: boolean) =>
      mutation.mutate({ keys: targets.map((shop) => shopValue(shop)), allProducts }),
  }
}
