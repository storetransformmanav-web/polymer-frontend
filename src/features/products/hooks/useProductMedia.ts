import { useCallback, useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  addProductMedia,
  detailsKey,
  fetchProductDetails,
  removeProductMedia,
} from '../../../app/store/productsSlice.ts'
import type {
  ProductDetail,
  ProductImage,
  ProductMediaInput,
  ProductWriteResult,
} from '../../../lib/api/endpoints.ts'
import { sameFile } from '../../../app/store/productPatch.ts'
import { useRefreshAfterSave } from './useSaveProduct.ts'

/** The backend's wording when it doesn't know the image id it was sent. */
const UNKNOWN_IMAGE = /not an image|not found|does not exist|no such/i

/**
 * Adding media to a product, and deleting one of its images — each its own
 * request (`POST /media`, `DELETE /media/{id}`), done at once rather than as
 * part of an edit's Save.
 *
 * A deleted image leaves every cached copy of the product the moment the server
 * confirms (see `removeProductMedia.fulfilled` in productsSlice), so it simply
 * disappears with no loader. Added files are different: the store has to
 * download them first, so they show up in the product a little later — the
 * caller shows them as "processing" meanwhile (`usePendingMedia`). After either
 * action the product, the list and the sync status refresh quietly.
 */
export function useProductMedia(product: ProductDetail) {
  const dispatch = useAppDispatch()
  const refreshAfterSave = useRefreshAfterSave()
  // The freshest copy of the product's images (the cache is refreshed in the background).
  const latest = useAppSelector(
    (state) => state.products.details[detailsKey(product.id)]?.data,
  )
  const [isAdding, setIsAdding] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A second click (or key press) while a request is still running must not send it again:
  // `isAdding` only turns true on the next render, so this is checked synchronously.
  const busy = useRef(false)
  const shop = product.shop?.key

  const add = useCallback(
    async (items: ProductMediaInput[]): Promise<ProductWriteResult | null> => {
      if (busy.current) return null
      busy.current = true
      setIsAdding(true)
      setError(null)
      const result = await dispatch(addProductMedia({ id: product.id, items, shop }))
      busy.current = false
      setIsAdding(false)
      if (!addProductMedia.fulfilled.match(result)) {
        setError(result.payload ?? 'Something went wrong. Please try again.')
        return null
      }
      refreshAfterSave(product.id, {})
      return result.payload
    },
    [dispatch, product.id, refreshAfterSave, shop],
  )

  /**
   * Deletes an image. The store re-syncs a product after a change and can give
   * its images new ids, so the id on screen may be out of date: this deletes by the
   * freshest id it knows for that file, and if the backend still says it doesn't
   * know the image, reads the product again and retries *once*, with the file's
   * current id. (A retry only ever follows a request the backend rejected as unknown
   * — nothing was deleted — and only when the id actually differs.)
   */
  const remove = useCallback(
    async (image: ProductImage): Promise<ProductWriteResult | null> => {
      if (busy.current) return null
      busy.current = true
      setIsRemoving(true)
      setError(null)
      const send = (attachmentId: string) =>
        dispatch(removeProductMedia({ id: product.id, attachmentId, shop }))

      let sentId =
        latest?.images.find((item) => sameFile(item.url, image.url))?.id ?? image.id
      let result = await send(sentId)

      if (
        !removeProductMedia.fulfilled.match(result) &&
        UNKNOWN_IMAGE.test(result.payload ?? '')
      ) {
        const fresh = await dispatch(fetchProductDetails({ id: product.id, force: true }))
        if (fetchProductDetails.fulfilled.match(fresh)) {
          const current = fresh.payload.data.images.find((item) =>
            sameFile(item.url, image.url),
          )
          if (!current) {
            busy.current = false
            setIsRemoving(false)
            setError(
              'That image is no longer on this product. The page has been refreshed.',
            )
            return null
          }
          if (current.id !== sentId) {
            sentId = current.id
            result = await send(sentId)
          }
        }
      }

      busy.current = false
      setIsRemoving(false)
      if (!removeProductMedia.fulfilled.match(result)) {
        setError(result.payload ?? 'Something went wrong. Please try again.')
        return null
      }
      refreshAfterSave(product.id, {})
      return result.payload
    },
    [dispatch, latest, product.id, refreshAfterSave, shop],
  )

  return { add, remove, isAdding, isRemoving, error }
}
