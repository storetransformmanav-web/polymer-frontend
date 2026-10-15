import { useCallback, useEffect, useState } from 'react'
import { useAppDispatch } from '../../../app/store/hooks.ts'
import { fetchProductDetails } from '../../../app/store/productsSlice.ts'
import type { ProductDetail, ProductMediaInput } from '../../../lib/api/endpoints.ts'

/** How often to look for the files the store has finished downloading, and for how long. */
const POLL_MS = 4000
const GIVE_UP_MS = 60_000

interface Queued {
  items: ProductMediaInput[]
  /** How many images the product had when they were added. */
  baseline: number
  startedAt: number
}

/**
 * Files just added by URL, shown as "processing" until they arrive. The store
 * downloads each file before it exists in the product (the answer to the add
 * was only "queued"), so this keeps the submitted files on screen and checks the
 * product every few seconds; each new image that shows up replaces one waiting
 * file, and after a minute the rest are dropped (they will still appear once the
 * store is done).
 */
export function usePendingMedia(product: ProductDetail) {
  const dispatch = useAppDispatch()
  const [queued, setQueued] = useState<Queued | null>(null)
  const { id } = product
  const active = queued !== null

  const queue = useCallback(
    (items: ProductMediaInput[]) =>
      setQueued({ items, baseline: product.images.length, startedAt: Date.now() }),
    [product.images.length],
  )

  // Everything that arrived so far has replaced a waiting file, oldest first.
  const arrived = queued ? Math.max(0, product.images.length - queued.baseline) : 0
  const pending = queued ? queued.items.slice(arrived) : []
  const done = queued !== null && pending.length === 0

  useEffect(() => {
    if (!active) return undefined
    const timer = window.setInterval(() => {
      void dispatch(fetchProductDetails({ id, force: true }))
      setQueued((current) =>
        current && Date.now() - current.startedAt > GIVE_UP_MS ? null : current,
      )
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [active, dispatch, id])

  // Everything arrived: forget the queue now (React's "adjust state while rendering"
  // pattern), so a later change to the product's images can't bring the tiles back.
  if (done) setQueued(null)

  return { pending, queue }
}
