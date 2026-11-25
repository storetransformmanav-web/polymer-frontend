import { useAppSelector } from '../../../app/store/hooks.ts'
import { Badge } from '../../../components/ui/Badge.tsx'
import { HeaderRefresh } from '../../../components/ui/HeaderRefresh.tsx'
import { HighlightQuery } from '../../../components/ui/Highlight.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import { AttendanceKpis } from '../components/AttendanceKpis.tsx'
import { AttendanceList } from '../components/AttendanceList.tsx'
import { AttendanceToolbar } from '../components/AttendanceToolbar.tsx'
import { useAttendance } from '../hooks/useAttendance.ts'
import { useAttendanceColumns } from '../hooks/useAttendanceColumns.ts'
import { ATTENDANCE_COLUMNS } from '../utils/columns.ts'
import { ColumnsMenu } from '../../../components/ui/ColumnsMenu.tsx'
import { formatClock, humanize, isAdministrator } from '../utils/format.ts'

/**
 * Attendance (HRMS): an administrator sees the calendar of every employee (`GET /hr/attendance`, with
 * search, employee, role, status and date filters and paging done by the server); anyone else sees only
 * their own days (`GET /hr/attendance/me`) with their current punch state. Laid out like the Products
 * list: figure cards, one toolbar card, and a table in its own scrolling box with the pagination fixed
 * under it. The dropdown choices load when the Filters grid is opened, not when the page opens.
 */
export function AttendancePage() {
  const role = useAppSelector((state) => state.auth.session?.user.role)
  const isAdmin = isAdministrator(role)

  const attendance = useAttendance(isAdmin)
  const columnChoice = useAttendanceColumns(isAdmin)
  const { filters, paging, current, employee } = attendance

  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      <HeaderRefresh refreshing={attendance.isFetching} onRefresh={attendance.retry} />

      <AttendanceKpis
        totals={attendance.totals}
        isAdmin={isAdmin}
        status={filters.status}
        onStatus={(status) => attendance.setFilters({ status })}
      />

      {!isAdmin && (employee || current) && (
        <section
          aria-label="Your attendance today"
          className="border-border bg-bg flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border px-5 py-3 text-[0.85rem]"
        >
          {employee && (
            <span className="flex min-w-0 flex-col">
              <span className="font-semibold">{employee.full_name}</span>
              <span className="text-text-muted text-[0.76rem]">
                {[employee.employee_code, employee.role_label, employee.position]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
          )}
          {current && (
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-text-muted text-[0.76rem] font-semibold">
                Right now
              </span>
              <Badge tone={current.state === 'off' ? 'neutral' : 'default'}>
                {current.state_label || humanize(current.state)}
              </Badge>
              {current.since_at && (
                <span className="text-text-muted text-[0.78rem]">
                  since {formatClock(current.since_at, current.since)}
                </span>
              )}
              {(current.breaks_today ?? 0) > 0 && (
                <span className="text-text-muted text-[0.78rem]">
                  · {current.breaks_today} break{current.breaks_today === 1 ? '' : 's'}{' '}
                  today
                </span>
              )}
            </span>
          )}
        </section>
      )}

      <AttendanceToolbar
        filters={filters}
        isAdmin={isAdmin}
        hasFilters={attendance.hasFilters}
        rangeProblem={attendance.rangeProblem}
        onChange={attendance.setFilters}
        onReset={attendance.resetFilters}
        actions={
          <div className="hidden md:block">
            <ColumnsMenu
              config={columnChoice.menuConfig}
              labelOf={(id) => ATTENDANCE_COLUMNS[id].label}
              onToggle={columnChoice.toggle}
              onMove={columnChoice.move}
              onReset={columnChoice.reset}
            />
          </div>
        }
      />

      <section
        aria-label="Attendance"
        className="border-border bg-bg relative flex flex-col overflow-hidden rounded-2xl border lg:min-h-0 lg:flex-1"
      >
        {/* Thin activity bar: results stay on screen while a refresh runs. */}
        <div
          aria-hidden="true"
          className={`bg-accent absolute inset-x-0 top-0 z-[2] h-0.5 origin-left transition-opacity duration-200 ${
            attendance.isFetching && !attendance.isPending
              ? 'animate-pulse opacity-100'
              : 'opacity-0'
          }`}
        />

        <HighlightQuery query={filters.search}>
          <AttendanceList
            items={attendance.items}
            isAdmin={isAdmin}
            columns={columnChoice.columns}
            isPending={attendance.isPending}
            error={attendance.error}
            hasFilters={attendance.hasFilters}
            isStale={attendance.isShowingPrevious}
            onRetry={attendance.retry}
            onClearFilters={attendance.resetFilters}
          />
        </HighlightQuery>

        {paging && paging.total > 0 && (
          <PaginationFooter
            page={paging.page}
            pageSize={filters.pageSize}
            total={paging.total}
            totalPages={paging.totalPages}
            onPageChange={(page) => attendance.setFilters({ page })}
            onPageSizeChange={(pageSize) => attendance.setFilters({ pageSize })}
          />
        )}
      </section>
    </div>
  )
}
