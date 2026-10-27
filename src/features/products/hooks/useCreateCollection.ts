import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { useAppDispatch } from '../../../app/store/hooks.ts'
import { fetchProductDetails } from '../../../app/store/productsSlice.ts'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import {
  api,
  type CollectionCreateResult,
  type ProductDetail,
} from '../../../lib/api/endpoints.ts'

/**
 * Makes a new manual collection with this product already in it (`POST /collections`
 * `{ title, shop, products: [id] }`) — for a name the store doesn't have yet, an immediate
 * action behind its own confirmation. The product is then re-read quietly so the new
 * collection shows in its list, and the cached collection searches are dropped so the new
 * one is offered next time. A second call while one is running is ignored (a repeat would
 * make the collection twice); a failure is kept as the backend's message and never retried.
 */
export function useCreateCollection(product: ProductDetail) {
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)

  const create = useCallback(
    async (title: string): Promise<CollectionCreateResult | null> => {
      if (busy.current) return null
      const shop = product.shop?.key
      if (!shop) {
        setError(
          "This product's store isn't known, so a collection can't be made for it.",
        )
        return null
      }
      busy.current = true
      setIsCreating(true)
      setError(null)
      try {
        const result = await api.collections.create({
          title,
          shop,
          products: [product.id],
        })
        void queryClient.invalidateQueries({ queryKey: ['collections'] })
        void dispatch(fetchProductDetails({ id: product.id, force: true }))
        return result
      } catch (failure) {
        setError(toUserMessage(failure))
        return null
      } finally {
        busy.current = false
        setIsCreating(false)
      }
    },
    [dispatch, product.id, product.shop?.key, queryClient],
  )

  return { create, isCreating, error }
}
