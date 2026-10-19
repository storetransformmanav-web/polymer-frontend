import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  fetchProductDetails,
  mediaQueued,
  mediaSettled,
} from '../../../app/store/productsSlice.ts'
import type { ProductDetail, ProductMediaInput } from '../../../lib/api/endpoints.ts'
import { useRefreshProductList } from './useRefreshProductList.ts'

/** How often to look for the files the store has finished downloading. */
const POLL_MS = 4000
/** After this long the store is "taking longer than usual": say so, and look less often. */
const SLOW_AFTER_MS = 60_000
const SLOW_POLL_MS = 16_000
/** Stop looking altogether (the files stay listed until they arrive or are dismissed). */
const STOP_AFTER_MS = 15 * 60_000

/**
 * Files just added by URL, shown as "processing" until they arrive. The store
 * downloads each file before it exists in the product (the answer to the add
 * was only "queued"), so this keeps the submitted files on screen and checks the
 * product every few seconds; each new image that shows up replaces one waiting
 * file. The waiting files live in the store (`pendingMedia`), so they survive
 * leaving the Media tab or the product, and they are not dropped when the store
 * is slow — they stay, marked `slow`, until they arrive or `dismiss` is called.
 */
export function usePendingMedia(product: ProductDetail) {
  const dispatch = useAppDispatch()
  const { id } = product
  const queued = useAppSelector((state) => state.products.pendingMedia[id])
  const [now, setNow] = useState(() => Date.now())
  const imageCount = product.images.length
  const ticks = useRef(0)

  const queue = useCallback(
    (items: ProductMediaInput[]) =>
      dispatch(mediaQueued({ id, items, baseline: imageCount, startedAt: Date.now() })),
    [dispatch, id, imageCount],
  )
  const dismiss = useCallback(() => dispatch(mediaSettled(id)), [dispatch, id])

  // Everything that arrived so far has replaced a waiting file, oldest first.
  const arrived = queued ? Math.max(0, imageCount - queued.baseline) : 0
  const pending = queued ? queued.items.slice(arrived) : []
  const done = queued !== undefined && pending.length === 0
  const startedAt = queued?.startedAt
  const active = startedAt !== undefined && !done

  const refreshList = useRefreshProductList()
  useEffect(() => {
    if (!done) return
    dispatch(mediaSettled(id))
    // The list was read when the files were sent, before the store had them, so its
    // row still shows no (or the old) image: read it again now that they are here.
    refreshList(false)
  }, [done, dispatch, id, refreshList])

  useEffect(() => {
    if (!active) return undefined
    ticks.current = 0
    const timer = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      const age = current - startedAt
      if (age > STOP_AFTER_MS) return
      ticks.current += 1
      // A slow store is asked less often (every fourth look).
      if (age > SLOW_AFTER_MS && ticks.current % (SLOW_POLL_MS / POLL_MS) !== 0) return
      void dispatch(fetchProductDetails({ id, force: true }))
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [active, dispatch, id, startedAt])

  const slow = active && now - startedAt > SLOW_AFTER_MS

  return { pending, queue, dismiss, slow }
}
