import { useAppSelector } from '../../../app/store/hooks.ts'
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
import { isAdministrator } from '../utils/format.ts'

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
  const { filters, paging } = attendance

  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      <HeaderRefresh refreshing={attendance.isFetching} onRefresh={attendance.retry} />

      <AttendanceKpis
        totals={attendance.totals}
        isAdmin={isAdmin}
        status={filters.status}
        onStatus={(status) => attendance.setFilters({ status })}
      />

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
