import { useQueries } from '@tanstack/react-query'
import { api } from '../../../lib/api/endpoints.ts'
import { statusCountFilters, toUserParams, type UserFilters } from './useUsers.ts'

/**
 * Number of users per status tab ('' = All Users), under the current
 * search/role filters. A count is `null` until it has loaded. Each is a cached
 * one-row query under the same `['users', …]` key family as the list, so
 * creating a user (which invalidates `['users']`) refreshes the counts too, and
 * paging doesn't refetch them. Pass a stable `statuses` array.
 *
 * The counts only appear inside the status dropdown, so nothing is requested until
 * `enabled` (the Filters grid is open).
 */
export function useUserStatusCounts(
  filters: UserFilters,
  statuses: readonly UserFilters['status'][],
  enabled = true,
): Record<string, number | null> {
  const queries = useQueries({
    queries: statuses.map((status) => {
      const params = toUserParams(statusCountFilters(filters, status))
      return {
        queryKey: ['users', params],
        queryFn: () => api.users.list(params),
        staleTime: 30_000,
        enabled,
      }
    }),
  })

  return Object.fromEntries(
    statuses.map((status, i) => [status, queries[i]?.data?.total ?? null]),
  )
}
