import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import {
  api,
  type AttendanceItem,
  type AttendanceListParams,
  type AttendanceStatus,
} from '../../../lib/api/endpoints.ts'
import { readAllAttendance } from '../api/allAttendance.ts'
import { rangeProblem } from '../utils/format.ts'
import { monthRange } from '../utils/month.ts'
import { ATTENDANCE_STALE_MS } from './useMonthlyAttendance.ts'

export interface AttendanceFilters {
  status: '' | AttendanceStatus
  /** Whole days, `YYYY-MM-DD`; both empty is "All Time". */
  from: string
  to: string
  page: number
  pageSize: number
}

/** One employee's days open on the month they were opened from. */
export const defaultAttendanceFilters = (month: string): AttendanceFilters => ({
  status: '',
  ...monthRange(month),
  page: 1,
  pageSize: 50,
})

/** Filters → the list's query parameters (empty ones left out). */
export function toAttendanceParams(
  employee: string,
  filters: AttendanceFilters,
): AttendanceListParams {
  const params: AttendanceListParams = {
    employee,
    date_from: filters.from,
    date_to: filters.to,
    page: filters.page,
    page_size: filters.pageSize,
  }
  if (filters.status) params.status = filters.status
  return params
}

/**
 * One employee's days (`GET /hr/attendance?employee=`): the dates, status and paging are the server's
 * work, and one range never goes past 93 days. "All Time" reads period after period
 * (`readAllAttendance`); its status choice and paging are done here.
 */
export function useEmployeeAttendance(employee: string, month: string) {
  const [filters, setFilters] = useState(() => defaultAttendanceFilters(month))
  const problem = rangeProblem(filters.from, filters.to)
  const enabled = problem === null
  const allTime = !filters.from && !filters.to

  const all = useQuery({
    queryKey: ['attendance', 'all', employee],
    queryFn: () => readAllAttendance({ employee }),
    staleTime: ATTENDANCE_STALE_MS,
    enabled: allTime,
  })
  const allRows = useMemo(() => {
    const rows = all.data?.items ?? []
    return filters.status ? rows.filter((row) => row.status === filters.status) : rows
  }, [all.data, filters.status])

  const params = toAttendanceParams(employee, filters)
  const list = useQuery({
    queryKey: ['attendance', 'list', params],
    queryFn: () => api.hr.attendance(params),
    staleTime: ATTENDANCE_STALE_MS,
    placeholderData: keepPreviousData,
    enabled: enabled && !allTime,
  })
  const query = allTime ? all : list

  const allPages = Math.max(1, Math.ceil(allRows.length / filters.pageSize))
  const allPage = Math.min(filters.page, allPages)
  const items: AttendanceItem[] = allTime
    ? allRows.slice((allPage - 1) * filters.pageSize, allPage * filters.pageSize)
    : (list.data?.items ?? [])

  const listPaging = list.data
    ? {
        page: list.data.page ?? filters.page,
        total: list.data.total ?? items.length,
        totalPages: list.data.total_pages ?? 1,
      }
    : null
  const allPaging = all.data
    ? { page: allPage, total: allRows.length, totalPages: allPages }
    : null

  const defaults = defaultAttendanceFilters(month)

  return {
    filters,
    items,
    totals: query.data?.totals ?? null,
    paging: allTime ? allPaging : listPaging,
    isPending: query.isPending && enabled,
    isFetching: query.isFetching,
    isShowingPrevious: query.isPlaceholderData,
    error: query.isError && !query.data ? toUserMessage(query.error) : null,
    hasFilters:
      filters.status !== '' ||
      filters.from !== defaults.from ||
      filters.to !== defaults.to,
    rangeProblem: problem,

    /** Anything other than an explicit page change goes back to page 1. */
    setFilters: (changes: Partial<AttendanceFilters>) =>
      setFilters((current) => ({
        ...current,
        ...changes,
        page: 'page' in changes ? (changes.page ?? 1) : 1,
      })),
    /** "Clear All": the opened month, no status; the page size stays. */
    resetFilters: () =>
      setFilters((current) => ({
        ...defaultAttendanceFilters(month),
        pageSize: current.pageSize,
      })),
    retry: () => void query.refetch(),
  }
}
