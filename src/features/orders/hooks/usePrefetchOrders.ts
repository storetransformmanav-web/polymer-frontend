import { useEffect } from 'react'
import { useAppDispatch } from '../../../app/store/hooks.ts'
import { prefetchOrders } from '../../../app/store/ordersSlice.ts'

/**
 * Starts loading the orders list as soon as the signed-in shell mounts, so by the
 * time the user opens the Orders page the data is already in the Redux cache and
 * renders with no wait.
 */
export function usePrefetchOrders() {
  const dispatch = useAppDispatch()

  useEffect(() => {
    dispatch(prefetchOrders())
  }, [dispatch])
}
