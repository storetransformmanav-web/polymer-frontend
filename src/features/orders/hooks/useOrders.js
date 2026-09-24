import { useEffect, useState } from 'react'
import { getOrders } from '../api/mockOrders.js'

/**
 * Loads the order list once on mount. Returns a `status` so pages can
 * render loading/error/empty states explicitly instead of guessing
 * from `orders.length`.
 */
export function useOrders() {
  const [status, setStatus] = useState('loading')
  const [orders, setOrders] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    getOrders()
      .then((data) => {
        if (cancelled) return
        setOrders(data)
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

  return { orders, status, error }
}
