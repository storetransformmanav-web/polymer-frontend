import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import {
  activityActionsOptions,
  activityListOptions,
  DEFAULT_ACTIVITY_FILTERS,
  toActivityParams,
} from './activityQueries.ts'

/**
 * Returns a function that loads the Activity page's first screen into the
 * cache. The sidebar calls it when the pointer (or keyboard focus) reaches the
 * "Activity Management" link, so the page opens with its data already there.
 *
 * It is deliberately *not* run at sign-in: the backend records every
 * request in this very log, and most people never open it — fetching it for
 * everyone would fill the log with noise (and fail for those without access).
 */
export function usePrefetchActivity() {
  const queryClient = useQueryClient()

  return useCallback(() => {
    void queryClient.prefetchQuery(
      activityListOptions(toActivityParams(DEFAULT_ACTIVITY_FILTERS)),
    )
    void queryClient.prefetchQuery(activityActionsOptions())
  }, [queryClient])
}
