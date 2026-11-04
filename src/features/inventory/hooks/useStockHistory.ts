import { useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import { fetchStockHistory, historyKey } from '../../../app/store/inventorySlice.ts'
import type { StockHistoryParams } from '../../../lib/api/endpoints.ts'

/**
 * The stock history for one request (a variant, a location, a status, a page), cached like the
 * rest: revisiting a page shows at once and refreshes quietly. Asked for only while `enabled`
 * (the History tab being open).
 */
export function useStockHistory(params: StockHistoryParams, enabled = true) {
  const dispatch = useAppDispatch()
  const key = historyKey(params)
  const entry = useAppSelector((state) => state.inventory.history[key])

  useEffect(() => {
    if (enabled) void dispatch(fetchStockHistory({ params: JSON.parse(key) }))
  }, [dispatch, key, enabled])

  const retry = useCallback(
    () => void dispatch(fetchStockHistory({ params: JSON.parse(key), force: true })),
    [dispatch, key],
  )

  const failed = entry?.error != null && entry.data == null
  return {
    data: entry?.data ?? null,
    items: entry?.data?.items ?? [],
    isPending: enabled && !entry?.data && !failed,
    isFetching: entry?.isFetching ?? false,
    error: failed ? entry.error : null,
    retry,
  }
}
