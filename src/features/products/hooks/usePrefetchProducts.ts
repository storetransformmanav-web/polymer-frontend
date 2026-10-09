import { useEffect } from 'react'
import { useAppDispatch } from '../../../app/store/hooks.ts'
import { prefetchProducts } from '../../../app/store/productsSlice.ts'

/**
 * Starts loading the products list as soon as the signed-in shell mounts,
 * so by the time the user opens the Products page the data is already in
 * the Redux cache and renders with no wait.
 */
export function usePrefetchProducts() {
  const dispatch = useAppDispatch()

  useEffect(() => {
    dispatch(prefetchProducts())
  }, [dispatch])
}
