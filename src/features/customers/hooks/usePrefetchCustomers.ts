import { useEffect } from 'react'
import { useAppDispatch } from '../../../app/store/hooks.ts'
import { prefetchCustomers } from '../../../app/store/customersSlice.ts'

/**
 * Starts loading the customers list as soon as the signed-in shell mounts,
 * so by the time the user opens the Customers page the data is already in
 * the Redux cache and renders with no wait.
 */
export function usePrefetchCustomers() {
  const dispatch = useAppDispatch()

  useEffect(() => {
    dispatch(prefetchCustomers())
  }, [dispatch])
}
