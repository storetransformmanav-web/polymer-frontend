import { useCallback, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  fetchProductDetails,
  fetchProducts,
  statusCountFilters,
  updateProduct,
} from '../../../app/store/productsSlice.ts'
import type { ProductUpdateBody, ProductWriteResult } from '../../../lib/api/endpoints.ts'

/** Every status tab, so their counts can be refreshed after a status change. */
const STATUS_TABS = ['', 'ACTIVE', 'DRAFT', 'ARCHIVED', 'UNLISTED'] as const

interface SaveArg {
  id: string
  body: ProductUpdateBody
  /** The product's store key (sent as `shop=`). */
  shop?: string | null
}

/**
 * Saves a product edit.
 *
 * The moment the server confirms, the product is patched in every cached copy
 * (list rows, details, tabs — see `updateProduct.fulfilled` in productsSlice),
 * so the new values are on screen immediately with no loader. This hook then
 * refetches the authoritative copy quietly in the background (the old values
 * stay visible until it lands) and, if the status changed, the tab counts.
 */
export function useSaveProduct() {
  const dispatch = useAppDispatch()
  const filters = useAppSelector((state) => state.products.filters)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = useCallback(
    async ({ id, body, shop }: SaveArg): Promise<ProductWriteResult | null> => {
      setIsSaving(true)
      setError(null)
      const result = await dispatch(updateProduct({ id, body, shop }))
      setIsSaving(false)

      if (!updateProduct.fulfilled.match(result)) {
        setError(result.payload ?? 'Something went wrong. Please try again.')
        return null
      }

      void dispatch(fetchProductDetails({ id, force: true }))
      void dispatch(fetchProducts({ filters, force: true }))
      if (body.status) {
        for (const status of STATUS_TABS) {
          void dispatch(
            fetchProducts({ filters: statusCountFilters(filters, status), force: true }),
          )
        }
      }
      return result.payload
    },
    [dispatch, filters],
  )

  return { save, isSaving, error, clearError: () => setError(null) }
}
