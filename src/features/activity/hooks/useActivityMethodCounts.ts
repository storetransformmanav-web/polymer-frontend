import { useQueries } from '@tanstack/react-query'
import {
  activityListOptions,
  isRangeInvalid,
  methodCountFilters,
  toActivityParams,
  type ActivityFilters,
} from './activityQueries.ts'

/**
 * Number of log entries per method tab ('' = All Methods), under the current
 * search/user/action/entity/date filters. A count is `null` until it has
 * loaded. Each is a cached one-row query, so paging doesn't refetch them. Pass
 * a stable `methods` array. (Each count is itself a request the backend logs.)
 */
export function useActivityMethodCounts(
  filters: ActivityFilters,
  methods: readonly ActivityFilters['method'][],
): Record<string, number | null> {
  // A backwards date range can't match anything — don't ask.
  const enabled = !isRangeInvalid(filters)
  const queries = useQueries({
    queries: methods.map((method) => ({
      ...activityListOptions(toActivityParams(methodCountFilters(filters, method))),
      enabled,
    })),
  })

  return Object.fromEntries(
    methods.map((method, i) => [method, queries[i]?.data?.total ?? null]),
  )
}
