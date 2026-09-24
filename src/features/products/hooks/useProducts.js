import { useEffect, useState } from 'react'
import { getProducts } from '../api/mockProducts.js'

/**
 * Loads the product list once on mount. Returns a `status` so pages
 * can render loading/error/empty states explicitly instead of
 * guessing from `products.length`.
 */
export function useProducts() {
  const [status, setStatus] = useState('loading')
  const [products, setProducts] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    getProducts()
      .then((data) => {
        if (cancelled) return
        setProducts(data)
        setStatus('success')
      })
      .catch((caughtError) => {
        if (cancelled) return
        setError(caughtError)
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { products, status, error }
}
