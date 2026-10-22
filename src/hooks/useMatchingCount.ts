import { useEffect, useRef, useState } from 'react'

/** What a feature tells the counter about its list. Keep it a module-level constant. */
export interface CountSource<F> {
  /** The same query with paging and sort removed — what decides *which* records match. */
  matchKey: (filters: F) => string
  /** How many records match `filters`, across every page. */
  count: (filters: F) => Promise<number>
}

/**
 * How many records match `filters`, across every page — for an export dialog's
 * "You'll export N". It is the list's own total when the filters are the list's
 * (nothing is requested), otherwise one request after a short pause in typing.
 * `null` while it loads (or if it failed).
 */
export function useMatchingCount<F>(
  filters: F,
  listFilters: F,
  listTotal: number,
  source: CountSource<F>,
): number | null {
  const key = source.matchKey(filters)
  const same = key === source.matchKey(listFilters)
  // The answer, tagged with the query it belongs to, so a stale one is never shown.
  const [answer, setAnswer] = useState<{ key: string; total: number } | null>(null)
  // The latest filters, read when the request goes out (`key` says when they changed).
  const latest = useRef(filters)
  useEffect(() => {
    latest.current = filters
  })

  useEffect(() => {
    if (same) return undefined
    let cancelled = false
    const timer = window.setTimeout(() => {
      source
        .count(latest.current)
        .then((total) => {
          if (!cancelled) setAnswer({ key, total })
        })
        .catch(() => {
          if (!cancelled) setAnswer(null)
        })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [same, key, source])

  if (same) return listTotal
  return answer?.key === key ? answer.total : null
}
