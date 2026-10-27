import { useCallback, useRef, useState } from 'react'
import type { ProductDetail, ProductWriteResult } from '../../../lib/api/endpoints.ts'
import { useSaveProduct } from './useSaveProduct.ts'

/**
 * Puts the product in one collection straight away (`collections_add` of
 * `PUT /products/{id}`, which takes the collection's **name**) — an immediate action behind
 * its own confirmation, not part of an edit's Save. The quiet refresh after the save brings
 * the collection (with its handle) into the product. A second call while one is running is
 * ignored; a failure is kept as the backend's message.
 */
export function useAddToCollection(product: ProductDetail) {
  const { save, isSaving, error } = useSaveProduct()
  const [started, setStarted] = useState(false)
  const busy = useRef(false)

  const add = useCallback(
    async (collectionName: string): Promise<ProductWriteResult | null> => {
      if (busy.current) return null
      busy.current = true
      setStarted(true)
      const result = await save({
        id: product.id,
        body: { collections_add: [collectionName] },
        shop: product.shop?.key,
      })
      busy.current = false
      return result
    },
    [product.id, product.shop?.key, save],
  )

  return { add, isAdding: started && isSaving, error }
}
