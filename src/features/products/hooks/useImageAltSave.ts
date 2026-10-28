import { useCallback } from 'react'
import type { ProductDetail } from '../../../lib/api/endpoints.ts'
import type { AltTextEditor } from '../utils/slides.ts'
import type { SavedHandler } from './useSectionEdit.ts'
import { useSaveProduct } from './useSaveProduct.ts'

/**
 * Saves one image's alt text from the lightbox: `PUT /products/{id}` with just
 * `media_update: [{ attachment_id, alt }]` — nothing else on the product is touched. The
 * slice patches every cached copy when the server confirms, so the lightbox shows the new
 * text at once; `onSaved` lets the page show its notice and follow the push to the store.
 */
export function useImageAltSave(
  product: ProductDetail | null,
  onSaved?: SavedHandler,
): AltTextEditor | undefined {
  const { save, isSaving, error, clearError } = useSaveProduct()

  const saveAlt = useCallback(
    async (imageId: string, alt: string) => {
      if (!product) return false
      const body = { media_update: [{ attachment_id: imageId, alt: alt.trim() }] }
      const result = await save({ id: product.id, body, shop: product.shop?.key })
      if (!result) return false
      onSaved?.(result, product, body)
      return true
    },
    [product, save, onSaved],
  )

  if (!product) return undefined
  return { save: saveAlt, isSaving, error, clearError }
}
