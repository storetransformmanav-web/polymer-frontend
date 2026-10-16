import { queryOptions } from '@tanstack/react-query'
import { api, type ActivityListParams } from '../../../lib/api/endpoints.ts'

/**
 * Query definitions shared by the page's hooks and by the prefetch that runs
 * when the sidebar link is hovered, so both use the very same cache entry:
 * a prefetched page is exactly what the page then reads.
 */

/** A page of the log stays "fresh" for this long; after that it refreshes in the background. */
export const ACTIVITY_STALE_MS = 30_000
/** Actions and users change rarely — keep their dropdown lists for five minutes. */
export const ACTIVITY_OPTIONS_STALE_MS = 5 * 60_000
/** Most users offered in the "User" dropdown (the Users API's maximum page size). */
export const USER_OPTIONS_LIMIT = 100

export interface ActivityFilters {
  search: string
  /** A user's id ('' = everyone). */
  userId: string
  /** An exact action name ('' = every action). */
  action: string
  entityType: string
  entityId: string
  /** `datetime-local` values ("2026-10-14T09:30", the browser's local time) or ''. */
  from: string
  to: string
  page: number
  pageSize: number
}

export const DEFAULT_ACTIVITY_FILTERS: ActivityFilters = {
  search: '',
  userId: '',
  action: '',
  entityType: '',
  entityId: '',
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

/** A `datetime-local` value (local time) → the ISO timestamp the API wants, or undefined. */
function toIso(local: string): string | undefined {
  if (!local) return undefined
  const date = new Date(local)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
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
  if (filters.action) params.action = filters.action
  const entityType = filters.entityType.trim()
  if (entityType) params.entity_type = entityType
  const entityId = filters.entityId.trim()
  if (entityId) params.entity_id = entityId
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
    filters.action !== '' ||
    filters.entityType.trim() !== '' ||
    filters.entityId.trim() !== '' ||
    filters.from !== '' ||
    filters.to !== ''
  )
}

export const activityListOptions = (params: ActivityListParams) =>
  queryOptions({
    queryKey: ['activity', 'list', params],
    queryFn: () => api.activity.list(params),
    staleTime: ACTIVITY_STALE_MS,
  })

export const activityActionsOptions = () =>
  queryOptions({
    queryKey: ['activity', 'actions'],
    queryFn: api.activity.actions,
    staleTime: ACTIVITY_OPTIONS_STALE_MS,
  })

export const activityUsersOptions = () =>
  queryOptions({
    queryKey: ['activity', 'users'],
    queryFn: () => api.users.list({ page: 1, page_size: USER_OPTIONS_LIMIT }),
    staleTime: ACTIVITY_OPTIONS_STALE_MS,
  })
