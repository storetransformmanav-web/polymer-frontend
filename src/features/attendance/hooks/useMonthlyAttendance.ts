import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import {
  api,
  type MonthlyAttendanceParams,
  type MonthlyAttendanceSort,
} from '../../../lib/api/endpoints.ts'
import { currentMonth } from '../utils/month.ts'

export const ATTENDANCE_STALE_MS = 30_000
/** The most people the API's `employees` filter takes. */
export const MAX_MEMBERS = 50

export interface ChosenMember {
  id: string
  name: string
}

export interface MonthlyFilters {
  /** `YYYY-MM`. */
  month: string
  search: string
  /** Empty means everyone. */
  members: ChosenMember[]
  role: string
  sort: MonthlyAttendanceSort
  order: 'asc' | 'desc'
  page: number
  pageSize: number
}

export const defaultMonthlyFilters = (): MonthlyFilters => ({
  month: currentMonth(),
  search: '',
  members: [],
  role: '',
  sort: 'name',
  order: 'asc',
  page: 1,
  pageSize: 20,
})

/** Filters → the grid's query parameters (empty ones left out). */
export function toMonthlyParams(filters: MonthlyFilters): MonthlyAttendanceParams {
  const params: MonthlyAttendanceParams = {
    month: filters.month,
    sort: filters.sort,
    order: filters.order,
    page: filters.page,
    page_size: filters.pageSize,
  }
  const search = filters.search.trim()
  if (search) params.search = search
  if (filters.members.length) {
    params.employees = filters.members.map((member) => member.id).join(',')
  }
  if (filters.role) params.role = filters.role
  return params
}

/**
 * The monthly grid (`GET /hr/attendance/monthly`). The month, search, members, role, sorting and
 * paging are all the server's work. It opens on this month; nothing is asked until the page opens.
 */
export function useMonthlyAttendance() {
  const [filters, setFilters] = useState(defaultMonthlyFilters)
  const params = toMonthlyParams(filters)
  const query = useQuery({
    queryKey: ['attendance', 'monthly', params],
    queryFn: () => api.hr.monthlyAttendance(params),
    staleTime: ATTENDANCE_STALE_MS,
    placeholderData: keepPreviousData,
  })

  const defaults = defaultMonthlyFilters()
  const hasFilters =
    filters.search.trim() !== '' ||
    filters.members.length > 0 ||
    filters.role !== '' ||
    filters.month !== defaults.month ||
    filters.sort !== defaults.sort ||
    filters.order !== defaults.order

  return {
    filters,
    data: query.data ?? null,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isShowingPrevious: query.isPlaceholderData,
    error: query.isError && !query.data ? toUserMessage(query.error) : null,
    hasFilters,

    /** Anything other than an explicit page change goes back to page 1. */
    setFilters: (changes: Partial<MonthlyFilters>) =>
      setFilters((current) => ({
        ...current,
        ...changes,
        page: 'page' in changes ? (changes.page ?? 1) : 1,
      })),
    /** "Clear All": this month, by name, no search or filter; the page size stays. */
    resetFilters: () =>
      setFilters((current) => ({
        ...defaultMonthlyFilters(),
        pageSize: current.pageSize,
      })),
    retry: () => void query.refetch(),
  }
}
