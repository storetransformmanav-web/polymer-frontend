import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppSelector } from '../../../app/store/hooks.ts'
import { HeaderRefresh } from '../../../components/ui/HeaderRefresh.tsx'
import { HighlightQuery } from '../../../components/ui/Highlight.tsx'
import { CalendarIcon } from '../../../components/ui/icons.tsx'
import { OpenTabsBar } from '../../../components/ui/OpenTabsBar.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import type { AttendanceEmployee, MonthRow } from '../../../lib/api/endpoints.ts'
import { AttendanceDetailsView } from '../components/AttendanceDetailsView.tsx'
import { MonthlyGrid } from '../components/MonthlyGrid.tsx'
import { MonthlyKpis } from '../components/MonthlyKpis.tsx'
import { MonthlyToolbar } from '../components/MonthlyToolbar.tsx'
import { useMonthlyAttendance } from '../hooks/useMonthlyAttendance.ts'
import { employeeKey, employeeName } from '../utils/employee.ts'

const LIST_PATH = '/hrms/attendance'
const MAX_TABS = 10
const SCROLL_VIEW = 'relative flex flex-col lg:min-h-0 lg:flex-1 lg:overflow-y-auto'

const employeePath = (id: string) => `${LIST_PATH}/${encodeURIComponent(id)}`

/** An opened employee: a tab in the strip above the grid. */
interface EmployeeTab {
  id: string
  /** The month it was opened from: its days open on that month. */
  month: string
  employee: AttendanceEmployee | null
}

/**
 * HRMS → Attendance. The list is the month's grid (`GET /hr/attendance/monthly`): one row per
 * member, one column per day up to today and the total hours; someone without the permission gets
 * only their own row. A member's name opens their days (`GET /hr/attendance?employee=`) in this same
 * page as a tab of its own (`/hrms/attendance/<user id>`); the grid stays mounted behind it, so
 * Back finds the month, filters and page as they were.
 */
export function AttendancePage() {
  const role = useAppSelector((state) => state.auth.session?.user.role)
  const attendance = useMonthlyAttendance()
  const { filters, data } = attendance
  const rows = data?.items ?? []
  const days = (data?.days ?? []).filter((day) => !day.is_future)
  // The answer says who may see the team; until it arrives, an administrator is assumed to.
  const isTeam = data?.scope ? data.scope !== 'own' : role?.toLowerCase() === 'admin'

  const navigate = useNavigate()
  const { '*': splat } = useParams()
  const activeId = splat ? splat : null

  const [tabs, setTabs] = useState<EmployeeTab[]>([])
  // A tab is opened **when the address arrives at an employee** (not whenever its tab is missing:
  // closing a tab removes it a moment before the address leaves it). This covers an address typed
  // or reloaded; a click on a name adds its tab itself, with what the row already knows.
  const [lastId, setLastId] = useState<string | null>(null)
  if (activeId !== lastId) {
    setLastId(activeId)
    if (activeId) {
      setTabs((current) =>
        current.some((tab) => tab.id === activeId)
          ? current
          : [...current, { id: activeId, month: filters.month, employee: null }].slice(
              -MAX_TABS,
            ),
      )
    }
  }
  const activeTab = tabs.find((tab) => tab.id === activeId) ?? null
  const preview =
    activeTab?.employee ??
    rows.find((row) => employeeKey(row.employee) === activeId)?.employee ??
    null

  function open(row: MonthRow) {
    const id = employeeKey(row.employee)
    const tab = { id, month: filters.month, employee: row.employee }
    setTabs((current) =>
      current.some((candidate) => candidate.id === id)
        ? current.map((candidate) => (candidate.id === id ? tab : candidate))
        : [...current, tab].slice(-MAX_TABS),
    )
    navigate(employeePath(id))
  }

  function closeTab(id: string) {
    const index = tabs.findIndex((tab) => tab.id === id)
    const neighbour = tabs[index + 1] ?? tabs[index - 1]
    setTabs((current) => current.filter((tab) => tab.id !== id))
    if (id === activeId) navigate(neighbour ? employeePath(neighbour.id) : LIST_PATH)
  }

  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      <HeaderRefresh
        visible={!activeId}
        refreshing={attendance.isFetching}
        onRefresh={attendance.retry}
      />

      {/* The figures belong to the grid: an employee's page has its own. */}
      <div className={activeId ? 'hidden' : undefined}>
        <MonthlyKpis totals={data?.totals ?? null} />
      </div>

      <OpenTabsBar
        tabs={tabs.map((tab) => {
          const known =
            tab.employee ??
            rows.find((row) => employeeKey(row.employee) === tab.id)?.employee
          const label = known ? employeeName(known) : 'Employee'
          return { id: tab.id, label, title: known?.employee_code ?? label }
        })}
        activeId={activeId}
        navLabel="Open employees"
        listLabel="All Attendance"
        kind="Employee"
        historyLabel="Opened employees"
        icon={CalendarIcon}
        onShowList={() => navigate(LIST_PATH)}
        onSelect={(id) => navigate(employeePath(id))}
        onClose={closeTab}
        onClear={() => {
          setTabs([])
          if (activeId) navigate(LIST_PATH)
        }}
      />

      {activeId && (
        <div className={SCROLL_VIEW}>
          <AttendanceDetailsView
            key={`${activeId}|${activeTab?.month ?? filters.month}`}
            employeeId={activeId}
            month={activeTab?.month ?? filters.month}
            preview={preview}
            onBack={() => navigate(LIST_PATH)}
          />
        </div>
      )}

      {/* Kept mounted but hidden while an employee is open. */}
      <div className={activeId ? 'hidden' : 'flex flex-col gap-4 lg:min-h-0 lg:flex-1'}>
        <MonthlyToolbar
          filters={filters}
          rows={rows}
          isTeam={isTeam}
          hasFilters={attendance.hasFilters}
          onChange={attendance.setFilters}
          onReset={attendance.resetFilters}
        />

        <section
          aria-label="Attendance"
          className="border-border bg-bg relative flex flex-col overflow-hidden rounded-2xl border lg:min-h-0 lg:flex-1"
        >
          {/* Thin activity bar: results stay on screen while a refresh runs. */}
          <div
            aria-hidden="true"
            className={`bg-accent absolute inset-x-0 top-0 z-[4] h-0.5 origin-left transition-opacity duration-200 ${
              attendance.isFetching && !attendance.isPending
                ? 'animate-pulse opacity-100'
                : 'opacity-0'
            }`}
          />

          <HighlightQuery query={filters.search}>
            <MonthlyGrid
              // While another month loads, the rows and their days on screen are still the old one's.
              month={data?.month ?? filters.month}
              days={days}
              rows={rows}
              sort={filters.sort}
              order={filters.order}
              isPending={attendance.isPending}
              error={attendance.error}
              hasFilters={attendance.hasFilters}
              isStale={attendance.isShowingPrevious}
              // A new column starts ascending; the same column flips direction.
              onSort={(sort) =>
                attendance.setFilters(
                  sort === filters.sort
                    ? { order: filters.order === 'asc' ? 'desc' : 'asc' }
                    : { sort, order: 'asc' },
                )
              }
              onOpen={open}
              onRetry={attendance.retry}
              onClearFilters={attendance.resetFilters}
            />
          </HighlightQuery>

          {data && (data.total ?? rows.length) > 0 && (
            <PaginationFooter
              page={data.page ?? filters.page}
              pageSize={filters.pageSize}
              total={data.total ?? rows.length}
              totalPages={data.total_pages ?? 1}
              onPageChange={(page) => attendance.setFilters({ page })}
              onPageSizeChange={(pageSize) => attendance.setFilters({ pageSize })}
            />
          )}
        </section>
      </div>
    </div>
  )
}
