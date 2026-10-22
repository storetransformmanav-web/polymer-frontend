import { useEffect, useRef, useState } from 'react'
import {
  cacheKey,
  toParams,
  type ProductFilters,
} from '../../../app/store/productsSlice.ts'
import { api } from '../../../lib/api/endpoints.ts'

/** The same query with the paging and sort removed — what decides *which* products match. */
const matchKey = (filters: ProductFilters) =>
  cacheKey({ ...filters, page: 1, pageSize: 1, sort: 'created_at', order: 'desc' })

/**
 * How many products match `filters`, across every page — for the export dialog's
 * "You'll export N products". It is the list's own total when the filters are the
 * list's (nothing is requested), otherwise one one-row request after a short pause
 * in typing. `null` while it loads (or if it failed).
 */
export function useMatchingCount(
  filters: ProductFilters,
  listFilters: ProductFilters,
  listTotal: number,
  enabled: boolean,
): number | null {
  const same = matchKey(filters) === matchKey(listFilters)
  const key = matchKey(filters)
  // The answer, tagged with the query it belongs to, so a stale one is never shown.
  const [answer, setAnswer] = useState<{ key: string; total: number } | null>(null)
  // The latest filters, read when the request goes out (`key` says when they changed).
  const latest = useRef(filters)
  useEffect(() => {
    latest.current = filters
  })

  useEffect(() => {
    if (!enabled || same) return undefined
    let cancelled = false
    const timer = window.setTimeout(() => {
      api.products
        .list(toParams({ ...latest.current, page: 1, pageSize: 1 }))
        .then((result) => {
          if (!cancelled) setAnswer({ key, total: result.total })
        })
        .catch(() => {
          if (!cancelled) setAnswer(null)
        })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [enabled, same, key])

  if (same) return listTotal
  return answer?.key === key ? answer.total : null
}
