import { useCallback } from 'react'
import { fetchCustomers } from '../../../app/store/customersSlice.ts'
import { useAppDispatch, useAppSelector } from '../../../app/store/hooks.ts'

/**
 * Refreshes the customers list for the current filters in the background. Whatever is on
 * screen stays until the new copy arrives, so nothing flashes or shows a loader.
 */
export function useRefreshCustomerList() {
  const dispatch = useAppDispatch()
  const filters = useAppSelector((state) => state.customers.filters)

  return useCallback(() => {
    void dispatch(fetchCustomers({ filters, force: true }))
  }, [dispatch, filters])
}
