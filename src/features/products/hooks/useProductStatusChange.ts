import { useCallback, useState } from 'react'
import { useAppDispatch } from '../../../app/store/hooks.ts'
import { updateProduct } from '../../../app/store/productsSlice.ts'
import type {
  ProductEditStatus,
  ProductListItem,
  ProductWriteResult,
} from '../../../lib/api/endpoints.ts'
import { useRefreshAfterSave } from './useSaveProduct.ts'

/**
 * Changing a product's status straight from its row in the list.
 *
 * The new value shows in the dropdown at once (`pending`) while the save is in
 * flight; once the server confirms, the list is patched (see
 * `updateProduct.fulfilled` in productsSlice) and the usual quiet refresh
 * follows. If the save fails the dropdown goes back to the old status and
 * the backend's message is kept in `errors` for that row. Rows save
 * independently, so several can be changed one after another.
 */
export function useProductStatusChange() {
  const dispatch = useAppDispatch()
  const refreshAfterSave = useRefreshAfterSave()
  const [pending, setPending] = useState<Record<string, ProductEditStatus>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const change = useCallback(
    async (
      product: Pick<ProductListItem, 'id' | 'shop'>,
      status: ProductEditStatus,
    ): Promise<ProductWriteResult | null> => {
      const { id } = product
      setErrors(({ [id]: _cleared, ...rest }) => rest)
      setPending((current) => ({ ...current, [id]: status }))

      const body = { status }
      const result = await dispatch(updateProduct({ id, body, shop: product.shop?.key }))
      setPending(({ [id]: _done, ...rest }) => rest)

      if (!updateProduct.fulfilled.match(result)) {
        setErrors((current) => ({
          ...current,
          [id]: result.payload ?? 'Something went wrong. Please try again.',
        }))
        return null
      }
      refreshAfterSave(id, body)
      return result.payload
    },
    [dispatch, refreshAfterSave],
  )

  return { change, pending, errors }
}
