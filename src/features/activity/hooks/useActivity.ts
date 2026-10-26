import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import {
  activityListOptions,
  DEFAULT_ACTIVITY_FILTERS,
  hasActiveActivityFilters,
  isRangeInvalid,
  toActivityParams,
  type ActivityFilters,
} from './activityQueries.ts'

/**
 * The Activity list: filters, paging and the query behind them. Built for
 * instant-feeling navigation:
 *  - every distinct query is cached, so revisiting a page or a filter renders
 *    at once from memory (and refreshes quietly once it is 30 s old);
 *  - while a new page or filter loads, the previous rows stay on screen
 *    instead of blanking the table;
 *  - nothing is requested ahead of time: a page loads when it is asked for.
 */
export function useActivity() {
  const [filters, setFilters] = useState(DEFAULT_ACTIVITY_FILTERS)
  const params = toActivityParams(filters)
  const rangeInvalid = isRangeInvalid(filters)

  const query = useQuery({
    ...activityListOptions(params),
    placeholderData: keepPreviousData,
    // Don't ask the server a question that can't have an answer.
    enabled: !rangeInvalid,
  })

  return {
    filters,
    data: query.data ?? null,
    items: query.data?.items ?? [],
    /** Nothing to show yet (first load). */
    isPending: query.isPending && !rangeInvalid,
    /** A request is in flight (first load, a new page/filter, or a refresh). */
    isFetching: query.isFetching,
    /** The rows on screen belong to the previous query while the new one loads. */
    isShowingPrevious: query.isPlaceholderData,
    error: query.isError && !query.data ? toUserMessage(query.error) : null,
    hasFilters: hasActiveActivityFilters(filters),
    rangeInvalid,

    /** Anything other than an explicit page change sends the user back to page 1. */
    setFilters: (changes: Partial<ActivityFilters>) =>
      setFilters((current) => ({
        ...current,
        ...changes,
        page: 'page' in changes ? (changes.page ?? 1) : 1,
      })),
    /** "Clear all": drops every narrowing filter, keeps the page size. */
    resetFilters: () =>
      setFilters((current) => ({
        ...DEFAULT_ACTIVITY_FILTERS,
        pageSize: current.pageSize,
      })),
    retry: () => void query.refetch(),
  }
}
