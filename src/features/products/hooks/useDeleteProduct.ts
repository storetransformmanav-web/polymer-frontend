import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import {
  deleteProduct,
  fetchProductDetails,
  fetchProducts,
  statusCountFilters,
} from '../../../app/store/productsSlice.ts'
import type { ProductWriteResult } from '../../../lib/api/endpoints.ts'
import { productSyncPrefix } from './useProductSyncHistory.ts'

/** Every status tab, so their counts can be refreshed (a removal moves a product between them). */
const STATUS_TABS = ['', 'ACTIVE', 'DRAFT', 'ARCHIVED'] as const

interface DeleteArg {
  id: string
  /** The product's store key (sent as `shop=`). */
  shop?: string | null
}

/**
 * Deletes a product (the backend archives it by default).
 *
 * The moment the server confirms, the product shows as Archived in every cached
 * copy (see `deleteProduct.fulfilled` in productsSlice) — no loader, no waiting
 * for a refetch. This hook then refreshes the list, the product and the tab
 * counts quietly.
 */
export function useDeleteProduct() {
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const filters = useAppSelector((state) => state.products.filters)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = useCallback(
    async ({ id, shop }: DeleteArg): Promise<ProductWriteResult | null> => {
      setIsDeleting(true)
      setError(null)
      const result = await dispatch(deleteProduct({ id, shop }))
      setIsDeleting(false)

      if (!deleteProduct.fulfilled.match(result)) {
        setError(result.payload ?? 'Something went wrong. Please try again.')
        return null
      }

      void dispatch(fetchProducts({ filters, force: true }))
      for (const status of STATUS_TABS) {
        void dispatch(
          fetchProducts({ filters: statusCountFilters(filters, status), force: true }),
        )
      }
      void queryClient.invalidateQueries({ queryKey: productSyncPrefix(id) })
      void dispatch(fetchProductDetails({ id, force: true }))
      return result.payload
    },
    [dispatch, filters, queryClient],
  )

  return { remove, isDeleting, error }
}
