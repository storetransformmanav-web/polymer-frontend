import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { toUserMessage } from '../../../lib/api/ApiError.ts'
import {
  api,
  type AttendanceCurrent,
  type AttendanceEmployee,
  type AttendanceItem,
  type AttendanceListParams,
  type AttendanceStatus,
  type AttendanceTotals,
} from '../../../lib/api/endpoints.ts'
import { readAllAttendance, type AllAttendanceFilters } from '../api/allAttendance.ts'
import { rangeProblem, todayRange } from '../utils/format.ts'

export const ATTENDANCE_STALE_MS = 30_000

export interface AttendanceFilters {
  search: string
  /** One employee's CRM user id ('' = everyone). */
  employee: string
  role: string
  status: '' | AttendanceStatus
  /** Whole days, `YYYY-MM-DD`; both empty is "All Time". */
  from: string
  to: string
  page: number
  pageSize: number
}

export const defaultAttendanceFilters = (): AttendanceFilters => ({
  search: '',
  employee: '',
  role: '',
  status: '',
  ...todayRange(),
  page: 1,
  pageSize: 50,
})

/** Filters → the list's query parameters (empty ones left out). */
export function toAttendanceParams(filters: AttendanceFilters): AttendanceListParams {
  const params: AttendanceListParams = {
    date_from: filters.from,
    date_to: filters.to,
    page: filters.page,
    page_size: filters.pageSize,
  }
  const search = filters.search.trim()
  if (search) params.search = search
  if (filters.employee) params.employee = filters.employee
  if (filters.role) params.role = filters.role
  if (filters.status) params.status = filters.status
  return params
}

const listOptions = (params: AttendanceListParams) =>
  queryOptions({
    queryKey: ['attendance', 'list', params],
    queryFn: () => api.hr.attendance(params),
    staleTime: ATTENDANCE_STALE_MS,
  })

const myOptions = (from: string, to: string) =>
  queryOptions({
    queryKey: ['attendance', 'me', from, to],
    queryFn: () => api.hr.myAttendance({ date_from: from, date_to: to }),
    staleTime: ATTENDANCE_STALE_MS,
  })

/**
 * The Attendance page's data. An administrator reads the calendar of every employee
 * (`GET /hr/attendance`: search, role, employee, status and dates are the server's work, and so is
 * the paging); anyone else reads only their own days (`GET /hr/attendance/me`, no paging — the status
 * choice narrows what that answer holds). Dates start on today and one range never goes
 * past 93 days. "All Time" reads period after period (`readAllAttendance`); its status choice
 * and paging are done here. Nothing is asked until the page opens.
 */
export function useAttendance(isAdmin: boolean) {
  const [filters, setFilters] = useState(defaultAttendanceFilters)
  const problem = rangeProblem(filters.from, filters.to)
  const enabled = problem === null
  const allTime = !filters.from && !filters.to

  const allFilters: AllAttendanceFilters = {}
  if (filters.search.trim()) allFilters.search = filters.search.trim()
  if (filters.employee) allFilters.employee = filters.employee
  if (filters.role) allFilters.role = filters.role
  const all = useQuery({
    queryKey: ['attendance', 'all', isAdmin, allFilters],
    queryFn: () => readAllAttendance(isAdmin, allFilters),
    staleTime: ATTENDANCE_STALE_MS,
    enabled: allTime,
  })
  const allRows = useMemo(() => {
    const rows = all.data?.items ?? []
    return filters.status ? rows.filter((row) => row.status === filters.status) : rows
  }, [all.data, filters.status])

  const list = useQuery({
    ...listOptions(toAttendanceParams(filters)),
    placeholderData: keepPreviousData,
    enabled: isAdmin && enabled && !allTime,
  })
  const mine = useQuery({
    ...myOptions(filters.from, filters.to),
    placeholderData: keepPreviousData,
    enabled: !isAdmin && enabled && !allTime,
  })
  const query = allTime ? all : isAdmin ? list : mine

  const mineItems: AttendanceItem[] = useMemo(() => {
    const data = mine.data
    if (!data) return []
    const rows = data.items.map((item) => ({
      ...item,
      employee: item.employee ?? data.employee ?? null,
    }))
    return filters.status ? rows.filter((row) => row.status === filters.status) : rows
  }, [mine.data, filters.status])

  const allPages = Math.max(1, Math.ceil(allRows.length / filters.pageSize))
  const allPage = Math.min(filters.page, allPages)
  const items: AttendanceItem[] = allTime
    ? isAdmin
      ? allRows.slice((allPage - 1) * filters.pageSize, allPage * filters.pageSize)
      : allRows
    : isAdmin
      ? (list.data?.items ?? [])
      : mineItems
  const totals: AttendanceTotals | null = query.data?.totals ?? null
  const employee: AttendanceEmployee | null = isAdmin
    ? null
    : ((allTime ? all.data : mine.data)?.employee ?? null)
  const current: AttendanceCurrent | null = isAdmin
    ? null
    : ((allTime ? all.data : mine.data)?.current ?? null)

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

  const defaults = defaultAttendanceFilters()
  const hasFilters =
    filters.search.trim() !== '' ||
    filters.employee !== '' ||
    filters.role !== '' ||
    filters.status !== '' ||
    filters.from !== defaults.from ||
    filters.to !== defaults.to

  return {
    filters,
    items,
    totals,
    employee,
    current,
    paging: isAdmin ? (allTime ? allPaging : listPaging) : null,
    isPending: query.isPending && enabled,
    isFetching: query.isFetching,
    isShowingPrevious: query.isPlaceholderData,
    error: query.isError && !query.data ? toUserMessage(query.error) : null,
    hasFilters,
    rangeProblem: problem,

    /** Anything other than an explicit page change goes back to page 1. */
    setFilters: (changes: Partial<AttendanceFilters>) =>
      setFilters((current) => ({
        ...current,
        ...changes,
        page: 'page' in changes ? (changes.page ?? 1) : 1,
      })),
    /** "Clear All": today, no search or filter; the page size stays. */
    resetFilters: () =>
      setFilters((current) => ({
        ...defaultAttendanceFilters(),
        pageSize: current.pageSize,
      })),
    retry: () => void query.refetch(),
  }
}
