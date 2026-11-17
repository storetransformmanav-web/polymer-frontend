import { queryOptions } from '@tanstack/react-query'
import { api, type ActivityListParams } from '../../../lib/api/endpoints.ts'
import { storeTimeToIso } from '../../../lib/storeTime.ts'

/**
 * Query definitions shared by the page's hooks and by the prefetch that runs
 * when the sidebar link is hovered, so both use the very same cache entry:
 * a prefetched page is exactly what the page then reads.
 */

/** A page of the log stays "fresh" for this long; after that it refreshes in the background. */
export const ACTIVITY_STALE_MS = 30_000
/** Actions and users change rarely — keep their dropdown lists for five minutes. */
export const ACTIVITY_OPTIONS_STALE_MS = 5 * 60_000

export interface ActivityFilters {
  search: string
  /** One user's id ('' = everyone). */
  userId: string
  /** A role name from `GET /roles` ('' = every role). */
  role: string
  /** `datetime-local` values ("2026-10-14T09:30", the browser's local time) or ''. */
  from: string
  to: string
  page: number
  pageSize: number
}

export const DEFAULT_ACTIVITY_FILTERS: ActivityFilters = {
  search: '',
  userId: '',
  role: '',
  from: '',
  to: '',
  page: 1,
  pageSize: 25,
}

/**
 * The date-range picker's whole days (`YYYY-MM-DD`, or '' for no limit) → the
 * filter values: from the start of the first day to the last second of the last.
 */
export function toDateFilters(range: {
  from: string
  to: string
}): Pick<ActivityFilters, 'from' | 'to'> {
  return {
    from: range.from ? `${range.from}T00:00:00` : '',
    to: range.to ? `${range.to}T23:59:59` : '',
  }
}

/** A `datetime-local` value (on the store's clock) → the ISO timestamp the API wants, or undefined. */
function toIso(local: string): string | undefined {
  if (!local) return undefined
  const [day, time = '00:00:00'] = local.split('T')
  return storeTimeToIso(day, time)
}

/** The start is after the end — the API would return nothing (or reject it). */
export function isRangeInvalid(filters: Pick<ActivityFilters, 'from' | 'to'>): boolean {
  const from = toIso(filters.from)
  const to = toIso(filters.to)
  return from !== undefined && to !== undefined && from > to
}

/** Filters → the query parameters the API understands (empty ones omitted). */
export function toActivityParams(filters: ActivityFilters): ActivityListParams {
  const params: ActivityListParams = { page: filters.page, page_size: filters.pageSize }

  const search = filters.search.trim()
  if (search) params.search = search
  if (filters.userId) params.user_id = filters.userId
  if (filters.role) params.role = filters.role
  const from = toIso(filters.from)
  if (from) params.from = from
  const to = toIso(filters.to)
  if (to) params.to = to

  return params
}

/** True when any narrowing filter (not paging) is applied. */
export function hasActiveActivityFilters(filters: ActivityFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.userId !== '' ||
    filters.role !== '' ||
    filters.from !== '' ||
    filters.to !== ''
  )
}

export const activityListOptions = (params: ActivityListParams) =>
  queryOptions({
    queryKey: ['activity', 'list', params],
    queryFn: () => api.activity.list(params),
    staleTime: ACTIVITY_STALE_MS,
    // The backend logs every request into this very log, so no automatic re-reads: switching
    // back to the browser tab or reconnecting would add entries the person never asked for.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

/** The people the User dropdown offers (asked for when the Filters grid is opened). */
export const activityUsersOptions = () =>
  queryOptions({
    queryKey: ['activity', 'user-options'],
    queryFn: () => api.users.list({ page: 1, page_size: 100 }),
    staleTime: ACTIVITY_OPTIONS_STALE_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

/** The roles the Role dropdown offers (asked for when the Filters grid is opened). */
export const activityRolesOptions = () =>
  queryOptions({
    queryKey: ['activity', 'role-options'],
    queryFn: () => api.roles.list(),
    staleTime: ACTIVITY_OPTIONS_STALE_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
