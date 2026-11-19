import { useMutation } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import { fetchInventory } from '../../../app/store/inventorySlice.ts'
import { ALL_SHOPS, shopLabel, shopValue } from '../../../app/store/shopSlice.ts'
import { useShops } from '../../../hooks/useShops.ts'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api, type InventorySyncResult } from '../../../lib/api/endpoints.ts'

/** How long the result (or the error) stays beside the button before it goes away. */
const SHOW_RESULT_MS = 20_000

/** What the last stock check did, for the pill beside the button. */
export interface InventorySyncOutcome {
  /** The backend's own words. */
  message: string
  /** One entry per store that answered. */
  results: InventorySyncResult[]
  /** The refusal of a store that could not be checked (the stores after it were not tried). */
  failure: string | null
  /** Only counted: nothing was saved in the CRM. */
  dryRun: boolean
}

/**
 * Checking a store's stock against Shopify (`POST /inventory/sync?dry_run=&shop=`). The backend runs it at
 * once and answers with the counts, so there is nothing to follow: with `dryRun` it only counts the
 * differences and saves nothing; without it the differences are saved in the CRM — and the stock list is
 * read again at once. Nothing is ever changed in Shopify. With "All shops" selected every connected,
 * active store is done, one after the other; with one store selected, just that one. Never retried (a
 * repeat would start a second run; the backend allows one at a time and answers 409). The result stays
 * beside the button for a while.
 */
export function useInventorySync() {
  const { shops, selected, status: shopsStatus } = useShops()
  const dispatch = useAppDispatch()
  const filters = useAppSelector((state) => state.inventory.filters)
  const [outcome, setOutcome] = useState<InventorySyncOutcome | null>(null)

  const targets = useMemo(() => {
    if (selected === ALL_SHOPS) {
      return shops.filter((shop) => shop.connected && shop.is_active)
    }
    return shops.filter((shop) => shopValue(shop) === selected)
  }, [shops, selected])

  const mutation = useMutation({
    mutationFn: async ({ keys, dryRun }: { keys: string[]; dryRun: boolean }) => {
      const results: InventorySyncResult[] = []
      let message = ''
      let failure: string | null = null
      // One store after another: a failure stops there but keeps what the earlier ones did.
      for (const key of keys) {
        try {
          const answer = await api.inventory.sync({ shop: key, dryRun })
          message = answer.message || message
          results.push(
            ...answer.results.map((result) => ({ ...result, shop: result.shop ?? key })),
          )
        } catch (error) {
          failure = toUserMessage(error)
          break
        }
      }
      return { message, results, failure, dryRun } satisfies InventorySyncOutcome
    },
    onMutate: () => setOutcome(null),
    onSuccess: (result) => {
      setOutcome(result)
      // What was saved shows at once: the stock list is read again (the old rows stay until then).
      if (!result.dryRun && result.results.length > 0) {
        void dispatch(fetchInventory({ filters, force: true }))
      }
    },
  })

  useEffect(() => {
    if (!outcome) return undefined
    const timer = window.setTimeout(() => setOutcome(null), SHOW_RESULT_MS)
    return () => window.clearTimeout(timer)
  }, [outcome])

  return {
    /** The stores that would be checked now (the selected one, or every visible store). */
    targets: targets.map((shop) => ({ key: shopValue(shop), label: shopLabel(shop) })),
    /** The store list has loaded (so there is something to check). */
    ready: shopsStatus === 'ready' && targets.length > 0,
    isSyncing: mutation.isPending,
    outcome,
    /** `dryRun` = only count the differences; false = save them in the CRM. */
    start: (dryRun: boolean) =>
      mutation.mutate({ keys: targets.map((shop) => shopValue(shop)), dryRun }),
  }
}
