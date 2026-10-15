import { useCallback, useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import { detailsKey, fetchProductDetails } from '../../../app/store/productsSlice.ts'

/**
 * A product's full details for the edit form, from the same Redux cache the
 * details page uses. Unlike `useProductDetails` it does not open a tab: editing
 * a product from the list shouldn't add it to the strip of opened products.
 *
 * Instant: hovering the row's pencil prefetches the details (see
 * `usePrefetchProduct`), so by the click they are normally cached and the form
 * opens fully populated, with no loader.
 */
export function useProductForEdit(id: string) {
  const dispatch = useAppDispatch()
  const entry = useAppSelector((state) => state.products.details[detailsKey(id)])

  useEffect(() => {
    void dispatch(fetchProductDetails({ id }))
  }, [dispatch, id])

  const retry = useCallback(
    () => void dispatch(fetchProductDetails({ id, force: true })),
    [dispatch, id],
  )

  return {
    product: entry?.data ?? null,
    error: entry?.data ? null : (entry?.error ?? null),
    retry,
  }
}
