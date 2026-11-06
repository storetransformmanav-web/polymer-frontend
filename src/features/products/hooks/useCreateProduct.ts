import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { useAppDispatch } from '../../../app/store/hooks.ts'
import {
  createProduct,
  mediaQueued,
  previewImageSet,
  productCreated,
} from '../../../app/store/productsSlice.ts'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import { api, type ProductCreateResult } from '../../../lib/api/endpoints.ts'
import {
  buildCreateBody,
  buildListItem,
  firstImageUrl,
  type CreatedShop,
  type CreateDraft,
} from '../utils/createDraft.ts'
import type { PickedFile } from '../utils/mediaFiles.ts'
import { useAddLocalMedia } from './useLocalMedia.ts'
import { useRefreshProductList } from './useRefreshProductList.ts'

/** What happened to the collections typed as new names: the ones made, and the ones that failed. */
export interface NewCollectionsOutcome {
  created: string[]
  failed: { title: string; message: string }[]
}

/**
 * Creates a product from the "Add product" form.
 *
 * The product is created in Shopify first (a second or two) and read back into
 * the CRM. The moment the answer arrives the new product is put into the cached
 * lists as a row built from the form (`productCreated` in productsSlice) — at the
 * top of the list, in the status counts — so it is on screen with no loader and no
 * refresh; the list and counts are then re-read quietly behind it. Creating is
 * never retried: a repeat could make the product twice.
 *
 * Files chosen from the computer can only be uploaded to a product that exists, so they go
 * up right after it is created — in the background (`useAddLocalMedia`), so the form is not
 * held up: the product's pictures are on screen at once from their local previews. A file
 * that fails doesn't undo the product; its tile in the Media tab says why and can retry.
 */
export function useCreateProduct() {
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const refreshList = useRefreshProductList()
  const { start } = useAddLocalMedia()
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = useCallback(
    async (
      draft: CreateDraft,
      shop: CreatedShop | null,
      files: readonly PickedFile[] = [],
    ): Promise<{
      product: ProductCreateResult
      collections: NewCollectionsOutcome
    } | null> => {
      setIsCreating(true)
      setError(null)
      const body = buildCreateBody(draft)
      const result = await dispatch(createProduct({ body }))
      setIsCreating(false)

      if (!createProduct.fulfilled.match(result)) {
        setError(result.payload ?? 'Something went wrong. Please try again.')
        return null
      }

      const created = result.payload
      dispatch(productCreated(buildListItem(draft, created, shop)))
      const preview = firstImageUrl(draft)
      if (preview) dispatch(previewImageSet({ id: created.product_id, url: preview }))
      // The store downloads the media afterwards, so the product has none of it yet:
      // queue the files as "processing" so its Media tab shows them (and each one is
      // replaced by the real image as it arrives) instead of "No images".
      if (body.media?.length) {
        dispatch(
          mediaQueued({
            id: created.product_id,
            items: body.media,
            baseline: 0,
            startedAt: Date.now(),
          }),
        )
      }
      // With an image, the store is still downloading it: re-reading the list now would
      // bring back a row with no image and wipe the preview, so the page re-reads it
      // a few seconds later, and keeps doing so until the image is there.
      if (!preview) refreshList(true)

      // A collection the store doesn't have is made now that the product exists, with the
      // product already in it. One at a time, never retried (a repeat would make it twice); one
      // that fails doesn't undo the product — the page says which, and the product's own page can
      // add it again.
      const collections: NewCollectionsOutcome = { created: [], failed: [] }
      const shopKey = shop?.key ?? draft.shop
      for (const title of draft.newCollections) {
        try {
          await api.collections.create({
            title,
            shop: shopKey,
            products: [created.product_id],
          })
          collections.created.push(title)
        } catch (failure) {
          collections.failed.push({ title, message: toUserMessage(failure) })
        }
      }
      if (draft.newCollections.length > 0) {
        // The new names are now in the store: offer them in every collection search.
        void queryClient.invalidateQueries({ queryKey: ['collections'] })
      }

      // Files from the computer don't hold the form up: they show on the new product at once,
      // from their own previews, and go up in the background (a failed one is marked on its
      // tile in the product's Media tab, with a way to try again).
      start(
        {
          id: created.product_id,
          shop: shop?.key,
          baseline: body.media?.length ?? 0,
          // The pictures chosen here are the product's own: they lead, ahead of a variant's.
          leading: true,
        },
        files,
      )
      return { product: created, collections }
    },
    [dispatch, queryClient, refreshList, start],
  )

  return {
    create,
    isCreating,
    error,
    clearError: () => setError(null),
  }
}
