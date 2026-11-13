import type { QueryClient } from '@tanstack/react-query'

/**
 * Every cached read that shows lock access: the locks (list and one), the tags (their counts, and
 * which of them are keys), the pickers' rows and a lock's customers. A change on **either** side —
 * the Lock Management pages (a lock's keys) or the Products pages (a product's tags) — marks all of
 * them stale, so the other side shows it when it is next on screen (or at once, when it is).
 * Lock Management and Products share this one list, so neither imports the other.
 */
const ACCESS_QUERY_ROOTS = [
  'locks',
  'access-tags',
  'lock-picker',
  'lock-customers',
] as const

export function invalidateAccessQueries(queryClient: QueryClient): Promise<unknown> {
  return Promise.all(
    ACCESS_QUERY_ROOTS.map((root) => queryClient.invalidateQueries({ queryKey: [root] })),
  )
}
