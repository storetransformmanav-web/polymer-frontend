import { useCallback, useRef, useState } from 'react'
import type { ProductDetail, ProductWriteResult } from '../../../lib/api/endpoints.ts'
import { useSaveProduct } from './useSaveProduct.ts'

/**
 * Takes the product out of one collection straight away (`collections_remove` of
 * `PUT /products/{id}`) — an immediate action behind its own alert, not part of an edit's
 * Save. On success the collection leaves every cached copy of the product at once (the
 * slice patches it) and the usual quiet refresh follows. A second call while one is running
 * is ignored; a failure is kept as the backend's message.
 */
export function useRemoveFromCollection(product: ProductDetail) {
  const { save, isSaving, error } = useSaveProduct()
  const [started, setStarted] = useState(false)
  const busy = useRef(false)

  const remove = useCallback(
    async (collectionId: string): Promise<ProductWriteResult | null> => {
      if (busy.current) return null
      busy.current = true
      setStarted(true)
      const result = await save({
        id: product.id,
        body: { collections_remove: [collectionId] },
        shop: product.shop?.key,
      })
      busy.current = false
      return result
    },
    [product.id, product.shop?.key, save],
  )

  return { remove, isRemoving: started && isSaving, error }
}
