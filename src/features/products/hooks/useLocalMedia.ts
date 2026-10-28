import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  addProductMedia,
  fetchProductDetails,
  localMediaAdded,
  localMediaLeft,
  localMediaStatus,
  localMediaUploaded,
  type LocalMedia,
  type LocalMediaItem,
} from '../../../app/store/productsSlice.ts'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import type {
  MediaType,
  ProductDetail,
  ProductWriteResult,
} from '../../../lib/api/endpoints.ts'
import { previewOf, releasePreview, type PickedFile } from '../utils/mediaFiles.ts'
import { frontOrder } from '../utils/mediaOrder.ts'
import { UPLOAD_CONCURRENCY, uploadFileToProduct } from './useFileUpload.ts'
import { pollDelay, SLOW_AFTER_MS, STOP_AFTER_MS } from './usePendingMedia.ts'
import { useRefreshAfterSave, useSaveProduct } from './useSaveProduct.ts'
import { useRefreshProductList } from './useRefreshProductList.ts'

/** The product a file is added to. */
export interface MediaTarget {
  id: string
  /** The product's store key (sent as `shop=`). */
  shop?: string | null
  /** How many images the product has right now (what arriving ones are counted after). */
  baseline: number
  /** The files are the product's own pictures: they are moved to the front once the store has them. */
  leading?: boolean
}

/**
 * The files themselves, by product and file key. They are not state (a `File` isn't
 * serialisable) and must outlive the component that picked them — the upload carries on
 * after the dialog or the Add product form is gone — and be there for a retry.
 */
const sources = new Map<string, { file: File; type: MediaType }>()
const sourceKey = (productId: string, key: string) => `${productId}|${key}`

/** Which of the waiting files the store's own copies have replaced: the oldest handed over first. */
function arrivedKeys(entry: LocalMedia | undefined, imageCount: number): string[] {
  if (!entry) return []
  const sent = entry.items.filter((item) => item.status === 'sent')
  const arrived = Math.min(Math.max(0, imageCount - entry.baseline), sent.length)
  return sent.slice(0, arrived).map((item) => item.key)
}

/**
 * Files chosen from the computer for a product, shown **at once** from their own local
 * previews. They go up in the background (a few at a time) and are then attached in one
 * `POST /media`; the store then needs a moment to process them, and the product lists them
 * only after that — each waiting file stays on screen, as the picture itself, until its
 * real copy is in the product. Nothing here is tied to the component that picked the files:
 * a closed dialog or a product form that was left doesn't stop the upload.
 *
 * A file that really fails stays on screen marked as failed, with the backend's reason, so it
 * can be tried again (`retry`) or taken away (`remove`) — it is never silently lost.
 */
export function useAddLocalMedia() {
  const dispatch = useAppDispatch()
  const refreshAfterSave = useRefreshAfterSave()

  /** Uploads what isn't uploaded yet, then attaches everything that is, in the order given. */
  const send = useCallback(
    async (
      target: MediaTarget,
      items: readonly LocalMediaItem[],
      onSent?: (result: ProductWriteResult) => void,
    ) => {
      const { id, shop } = target
      const uploaded = new Map<string, string>()
      for (const item of items)
        if (item.resourceUrl) uploaded.set(item.key, item.resourceUrl)

      const waiting = items.filter((item) => !item.resourceUrl)
      let next = 0
      async function uploadOne(item: LocalMediaItem) {
        const source = sources.get(sourceKey(id, item.key))
        if (!source) {
          dispatch(
            localMediaStatus({
              id,
              keys: [item.key],
              status: 'failed',
              error: 'This file is no longer available. Remove it and choose it again.',
            }),
          )
          return
        }
        try {
          const resourceUrl = await uploadFileToProduct(
            id,
            shop,
            source.file,
            source.type,
          )
          uploaded.set(item.key, resourceUrl)
          dispatch(localMediaUploaded({ id, key: item.key, resourceUrl }))
        } catch (error) {
          dispatch(
            localMediaStatus({
              id,
              keys: [item.key],
              status: 'failed',
              error: toUserMessage(error),
            }),
          )
        }
      }
      async function worker() {
        while (next < waiting.length) {
          const item = waiting[next]
          next += 1
          await uploadOne(item)
        }
      }
      await Promise.all(
        Array.from({ length: Math.min(UPLOAD_CONCURRENCY, waiting.length) }, worker),
      )

      // One request for everything that is up, in the order the files were chosen (the first
      // image stays the featured one whichever upload finished first).
      const ready = items.filter((item) => uploaded.has(item.key))
      if (ready.length === 0) return
      const keys = ready.map((item) => item.key)
      const result = await dispatch(
        addProductMedia({
          id,
          items: ready.map((item) => ({
            url: uploaded.get(item.key) as string,
            media_type: item.mediaType,
          })),
          shop,
        }),
      )
      if (addProductMedia.fulfilled.match(result)) {
        dispatch(localMediaStatus({ id, keys, status: 'sent' }))
        refreshAfterSave(id, {})
        onSent?.(result.payload)
      } else {
        dispatch(
          localMediaStatus({
            id,
            keys,
            status: 'failed',
            error: result.payload ?? 'The files could not be added. Please try again.',
          }),
        )
      }
    },
    [dispatch, refreshAfterSave],
  )

  /** Shows the files now and starts their upload. Returns at once. */
  const start = useCallback(
    (
      target: MediaTarget,
      files: readonly PickedFile[],
      onSent?: (result: ProductWriteResult) => void,
    ) => {
      if (files.length === 0) return
      // The picker lets go of its own previews when it goes away; these are the tiles' own.
      const items: LocalMediaItem[] = files.map((picked) => {
        sources.set(sourceKey(target.id, picked.key), {
          file: picked.file,
          type: picked.type,
        })
        return {
          key: picked.key,
          name: picked.file.name,
          mediaType: picked.type,
          previewUrl: previewOf(picked.file),
          status: 'uploading',
        }
      })
      dispatch(
        localMediaAdded({
          id: target.id,
          items,
          baseline: target.baseline,
          leading: target.leading,
        }),
      )
      void send(target, items, onSent)
    },
    [dispatch, send],
  )

  /** Tries a failed file again: only the missing step is redone (an uploaded file is just attached). */
  const retry = useCallback(
    (
      target: MediaTarget,
      item: LocalMediaItem,
      onSent?: (result: ProductWriteResult) => void,
    ) => {
      dispatch(localMediaStatus({ id: target.id, keys: [item.key], status: 'uploading' }))
      void send(target, [{ ...item, status: 'uploading', error: undefined }], onSent)
    },
    [dispatch, send],
  )

  /** Takes a waiting file off the list (a failed one, or one the user no longer wants). */
  const remove = useCallback(
    (productId: string, item: LocalMediaItem) => {
      releasePreview(item.previewUrl)
      sources.delete(sourceKey(productId, item.key))
      dispatch(localMediaLeft({ id: productId, keys: [item.key] }))
    },
    [dispatch],
  )

  return { start, retry, remove }
}

/**
 * The waiting files of a product, for the tabs to show — the ones whose real copy is already
 * in the product are left out (in the same render the image appears, so a picture is never
 * shown twice).
 */
export function useLocalMedia(product: ProductDetail | null) {
  const id = product?.id
  const entry = useAppSelector((state) =>
    id ? state.products.localMedia[id] : undefined,
  )
  const imageCount = product?.images.length ?? 0

  const items = useMemo(() => {
    if (!entry) return []
    const gone = new Set(arrivedKeys(entry, imageCount))
    return entry.items.filter((item) => !gone.has(item.key))
  }, [entry, imageCount])

  const sent = items.filter((item) => item.status === 'sent').length
  const startedAt = entry?.startedAt

  // "Taking longer than usual" is only a matter of time passing: tick while waiting on the store.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (sent === 0) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 5000)
    return () => window.clearInterval(timer)
  }, [sent])
  const slow = sent > 0 && startedAt !== undefined && now - startedAt > SLOW_AFTER_MS

  return { items, sent, slow }
}

/**
 * Keeps the waiting files moving, for the product that is open (call it once, wherever the
 * product is shown): while the store is processing some it re-reads the product every few
 * seconds, and each time the product lists one more image the oldest waiting file leaves its
 * list (its preview is let go) — the real image has taken its place.
 */
export function useLocalMediaSync(product: ProductDetail | null) {
  const dispatch = useAppDispatch()
  const refreshList = useRefreshProductList()
  const { save } = useSaveProduct()
  const id = product?.id
  const entry = useAppSelector((state) =>
    id ? state.products.localMedia[id] : undefined,
  )
  const imageCount = product?.images.length ?? 0

  const gone = useMemo(() => arrivedKeys(entry, imageCount), [entry, imageCount])
  useEffect(() => {
    if (!id || !entry || gone.length === 0) return
    // The product's own pictures come first: the store appended them after what went in with
    // the product (a variant's picture, say), so they are moved in front of it — the first one
    // is then the main image. The ones already moved stay first, in the order they were chosen.
    const order = entry.leading
      ? frontOrder(product?.images ?? [], entry.baseline, entry.placed ?? 0, gone.length)
      : null
    if (order) void save({ id, body: { media_order: order }, shop: product?.shop?.key })
    for (const item of entry.items) {
      if (!gone.includes(item.key)) continue
      releasePreview(item.previewUrl)
      sources.delete(sourceKey(id, item.key))
    }
    dispatch(localMediaLeft({ id, keys: gone, arrived: true }))
    // The list was read before the store had the files: read it again now that they are here.
    refreshList(false)
  }, [dispatch, entry, gone, id, product, refreshList, save])

  const startedAt = entry?.startedAt
  const waitingOnStore = entry?.items.some((item) => item.status === 'sent') ?? false
  useEffect(() => {
    if (!id || !waitingOnStore || startedAt === undefined) return undefined
    const begun = startedAt
    let timer: number | undefined
    function look() {
      const age = Date.now() - begun
      if (age > STOP_AFTER_MS) return
      void dispatch(fetchProductDetails({ id: id as string, force: true }))
      timer = window.setTimeout(look, pollDelay(age))
    }
    timer = window.setTimeout(look, pollDelay(Date.now() - begun))
    return () => window.clearTimeout(timer)
  }, [dispatch, id, startedAt, waitingOnStore])
}
