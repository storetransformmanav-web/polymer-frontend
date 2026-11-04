import { useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  fetchInventory,
  fetchVariantStock,
  saveStock,
  trackAdjustment,
  writeDismissed,
  type StockRequest,
  type StockWrite,
} from '../../../app/store/inventorySlice.ts'
import type { StockWriteResult } from '../../../lib/api/endpoints.ts'

export type SaveOutcome =
  { ok: true; result: StockWriteResult } | { ok: false; error: string }

/**
 * Sends a stock change ("Set to" / "Adjust by") and follows it to Shopify.
 *
 * The numbers change on screen the moment it is sent (the slice patches the variant and its
 * list row); a refusal puts them back and says why. An accepted change comes back `pending`;
 * every one is followed (`trackAdjustment`) until Shopify confirms or refuses it — the notices
 * (`writes`) show where each one is, and a refused one can be sent again with `retry`.
 */
export function useStockWrites() {
  const dispatch = useAppDispatch()
  const writes = useAppSelector((state) => state.inventory.writes)
  const filters = useAppSelector((state) => state.inventory.filters)

  const save = useCallback(
    async (arg: {
      ref: string
      request: StockRequest
      label: string
    }): Promise<SaveOutcome> => {
      const result = await dispatch(saveStock(arg))
      if (saveStock.fulfilled.match(result)) {
        for (const adjustment of result.payload.adjustments) {
          void dispatch(trackAdjustment({ id: adjustment.id }))
        }
        return { ok: true, result: result.payload }
      }
      // The edit was put back; read the real numbers again, quietly.
      void dispatch(fetchVariantStock({ ref: arg.ref, force: true }))
      void dispatch(fetchInventory({ filters, force: true }))
      return {
        ok: false,
        error: result.payload ?? 'Something went wrong. Please try again.',
      }
    },
    [dispatch, filters],
  )

  const dismiss = useCallback((id: string) => dispatch(writeDismissed(id)), [dispatch])

  /** Sends a refused change again (and clears the old notice). */
  const retry = useCallback(
    (write: StockWrite) => {
      dispatch(writeDismissed(write.id))
      return save({ ref: write.ref, request: write.request, label: write.label })
    },
    [dispatch, save],
  )

  return {
    writes: Object.values(writes).sort((a, b) => b.startedAt - a.startedAt),
    save,
    dismiss,
    retry,
  }
}
