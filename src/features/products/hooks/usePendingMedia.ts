import { useCallback, useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  fetchProductDetails,
  mediaSettled,
  type PendingMedia,
} from '../../../app/store/productsSlice.ts'
import type { ProductDetail } from '../../../lib/api/endpoints.ts'
import { frontOrder } from '../utils/mediaOrder.ts'
import { useRefreshProductList } from './useRefreshProductList.ts'
import { useSaveProduct } from './useSaveProduct.ts'

/**
 * How often to look for the files the store has finished downloading: often at first (a
 * file is usually ready within seconds, and every second of waiting makes people add it
 * again), then less often.
 */
const FAST_POLL_MS = 2000
const FAST_UNTIL_MS = 30_000
const POLL_MS = 4000
/** After this long the store is "taking longer than usual": say so, and look less often. */
export const SLOW_AFTER_MS = 60_000
const SLOW_POLL_MS = 16_000

/** How long to wait before the next look, given how long the files have been waiting. */
export function pollDelay(ageMs: number): number {
  if (ageMs < FAST_UNTIL_MS) return FAST_POLL_MS
  return ageMs < SLOW_AFTER_MS ? POLL_MS : SLOW_POLL_MS
}
/** Stop looking altogether (the files stay listed until they arrive or are dismissed). */
export const STOP_AFTER_MS = 15 * 60_000

/** The files still waiting for the store, and how many of them the product already lists. */
function waitingFiles(product: ProductDetail | null, queued: PendingMedia | undefined) {
  const imageCount = product?.images.length ?? 0
  // Everything that arrived so far has replaced a waiting file, oldest first.
  const arrived = queued ? Math.max(0, imageCount - queued.baseline) : 0
  const pending = queued ? queued.items.slice(arrived) : []
  const done = queued !== undefined && pending.length === 0
  return { pending, done, startedAt: queued?.startedAt }
}

/**
 * Keeps the waiting files moving, for the product that is open — call it once, wherever the
 * product is shown (`ProductDetailsView`), **not** only on the Media tab: the waiting files
 * are remembered across a page refresh, and after one the user may be on the Overview, which
 * must pick the images up as soon as the store has them too. While files wait it re-reads the
 * product every few seconds (`pollDelay`); when the last one has arrived it lets the waiting
 * list go and re-reads the products list, whose row was read before the store had them.
 */
export function usePendingMediaSync(product: ProductDetail | null) {
  const dispatch = useAppDispatch()
  const id = product?.id
  const queued = useAppSelector((state) =>
    id ? state.products.pendingMedia[id] : undefined,
  )
  const { done, startedAt } = waitingFiles(product, queued)
  const active = startedAt !== undefined && !done
  const { save } = useSaveProduct()

  const refreshList = useRefreshProductList()
  useEffect(() => {
    if (!id || !done) return
    // Files from the Add product form lead the product's images (a refresh in the meantime
    // must not cost them their place): moved in front now that all of them are here.
    const order = queued?.leading
      ? frontOrder(
          product?.images ?? [],
          queued.baseline,
          queued.placed ?? 0,
          queued.items.length,
        )
      : null
    if (order) void save({ id, body: { media_order: order }, shop: product?.shop?.key })
    dispatch(mediaSettled(id))
    // The list was read when the files were sent, before the store had them, so its
    // row still shows no (or the old) image: read it again now that they are here.
    refreshList(false)
  }, [done, dispatch, id, product, queued, refreshList, save])

  useEffect(() => {
    if (!id || !active || startedAt === undefined) return undefined
    const begun = startedAt
    let timer: number | undefined
    function look() {
      const age = Date.now() - begun
      if (age > STOP_AFTER_MS) return
      void dispatch(fetchProductDetails({ id: id as string, force: true }))
      timer = window.setTimeout(look, pollDelay(age))
    }
    timer = window.setTimeout(look, FAST_POLL_MS)
    return () => window.clearTimeout(timer)
  }, [active, dispatch, id, startedAt])
}

/**
 * Files added by address (a created product's image links), shown as "processing" until they
 * arrive. The store downloads each file before it exists in the product (the answer to the
 * add was only "queued"), so the submitted files stay on screen — they live in the store
 * (`pendingMedia`), so they survive leaving the Media tab or the product, and a page refresh —
 * while `usePendingMediaSync` checks the product; each new image that shows up replaces one
 * waiting file. They are not dropped when the store is slow: they stay, marked `slow`, until
 * they arrive or `dismiss` is called.
 */
export function usePendingMedia(product: ProductDetail) {
  const dispatch = useAppDispatch()
  const { id } = product
  const queued = useAppSelector((state) => state.products.pendingMedia[id])
  const { pending, done, startedAt } = waitingFiles(product, queued)
  const active = startedAt !== undefined && !done

  const dismiss = useCallback(() => dispatch(mediaSettled(id)), [dispatch, id])

  // "Taking longer than usual" is only a matter of time passing: tick while waiting.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 5000)
    return () => window.clearInterval(timer)
  }, [active])

  const slow = active && now - startedAt > SLOW_AFTER_MS

  return { pending, dismiss, slow }
}
