import { useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'
import { fetchProducts, statusCountFilters } from '../../../app/store/productsSlice.ts'

/** Every status tab, so their counts can be refreshed together. */
const STATUS_TABS = ['', 'ACTIVE', 'DRAFT', 'ARCHIVED'] as const

/**
 * Refreshes the products list for the current filters — and, with
 * `withCounts`, every status tab's count — in the background. Whatever is on
 * screen stays until the new copy arrives, so nothing flashes or shows a loader.
 */
export function useRefreshProductList() {
  const dispatch = useAppDispatch()
  const filters = useAppSelector((state) => state.products.filters)

  return useCallback(
    (withCounts = false) => {
      void dispatch(fetchProducts({ filters, force: true }))
      if (!withCounts) return
      for (const status of STATUS_TABS) {
        void dispatch(
          fetchProducts({ filters: statusCountFilters(filters, status), force: true }),
        )
      }
    },
    [dispatch, filters],
  )
}
