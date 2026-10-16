import { useCallback, useState } from 'react'
import { useAppDispatch } from '../../../app/store/hooks.ts'
import { createProduct, productCreated } from '../../../app/store/productsSlice.ts'
import type { ProductCreateResult } from '../../../lib/api/endpoints.ts'
import {
  buildCreateBody,
  buildListItem,
  firstImageUrl,
  type CreatedShop,
  type CreateDraft,
} from '../utils/createDraft.ts'
import { useRefreshProductList } from './useRefreshProductList.ts'

/**
 * Creates a product from the "Add product" form.
 *
 * The product is created in Shopify first (a second or two) and read back into
 * the CRM. The moment the answer arrives the new product is put into the cached
 * lists as a row built from the form (`productCreated` in productsSlice) — at the
 * top of the list, in the status counts — so it is on screen with no loader and no
 * refresh; the list and counts are then re-read quietly behind it. Creating is
 * never retried: a repeat could make the product twice.
 */
export function useCreateProduct() {
  const dispatch = useAppDispatch()
  const refreshList = useRefreshProductList()
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = useCallback(
    async (
      draft: CreateDraft,
      shop: CreatedShop | null,
    ): Promise<ProductCreateResult | null> => {
      setIsCreating(true)
      setError(null)
      const result = await dispatch(createProduct({ body: buildCreateBody(draft) }))
      setIsCreating(false)

      if (!createProduct.fulfilled.match(result)) {
        setError(result.payload ?? 'Something went wrong. Please try again.')
        return null
      }

      dispatch(productCreated(buildListItem(draft, result.payload, shop)))
      // With an image, the store is still downloading it: re-reading the list now would
      // bring back a row with no image and wipe the preview, so the page re-reads it
      // a few seconds later, and keeps doing so until the image is there.
      if (!firstImageUrl(draft)) refreshList(true)
      return result.payload
    },
    [dispatch, refreshList],
  )

  return { create, isCreating, error, clearError: () => setError(null) }
}
