import { ColumnsMenu } from '../../../components/ui/ColumnsMenu.tsx'
import {
  DetailsHeader,
  HeaderChip,
  HeaderTile,
} from '../../../components/ui/DetailsHeader.tsx'
import {
  CalendarIcon,
  TagIcon,
  UserCogIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import { PaginationFooter } from '../../../components/ui/PaginationFooter.tsx'
import type { AttendanceEmployee } from '../../../lib/api/endpoints.ts'
import { initials } from '../../../lib/format.ts'
import { useEmployeeAttendance } from '../hooks/useAttendance.ts'
import { useAttendanceColumns } from '../hooks/useAttendanceColumns.ts'
import { ATTENDANCE_COLUMNS } from '../utils/columns.ts'
import { employeeName } from '../utils/employee.ts'
import { formatDay } from '../utils/format.ts'
import { monthRange } from '../utils/month.ts'
import { AttendanceKpis } from './AttendanceKpis.tsx'
import { AttendanceList } from './AttendanceList.tsx'
import { AttendanceToolbar } from './AttendanceToolbar.tsx'

interface AttendanceDetailsViewProps {
  /** CRM user id or employee ID. */
  employeeId: string
  /** The month it was opened from, `YYYY-MM`. */
  month: string
  /** The grid's row, to draw the header before the days arrive. */
  preview: AttendanceEmployee | null
  onBack: () => void
}

/**
 * One employee's attendance (`GET /hr/attendance?employee=`): who they are, the range's figures, and
 * a row per day that opens to that day's punch timeline.
 */
export function AttendanceDetailsView({
  employeeId,
  month,
  preview,
  onBack,
}: AttendanceDetailsViewProps) {
  const attendance = useEmployeeAttendance(employeeId, month)
  const columnChoice = useAttendanceColumns()
  const { filters, paging } = attendance

  const employee = preview ?? attendance.items[0]?.employee ?? null
  const name = employeeName(employee)
  const role = employee?.role_label ?? employee?.role

  return (
    <div className="flex flex-col gap-4 lg:min-h-full">
      <article className="border-border bg-bg shrink-0 rounded-2xl border">
        <DetailsHeader
          visual={<HeaderTile>{employee?.initials || initials(name) || '?'}</HeaderTile>}
          title={name}
          chips={
            <>
              {employee?.employee_code && (
                <HeaderChip icon={TagIcon} label="Employee ID">
                  {employee.employee_code}
                </HeaderChip>
              )}
              {role && (
                <HeaderChip icon={UserCogIcon} label="Role">
                  {role}
                </HeaderChip>
              )}
              {employee?.position && (
                <HeaderChip icon={UsersIcon} label="Position">
                  {employee.position}
                </HeaderChip>
              )}
              {employee?.department && (
                <HeaderChip icon={UsersIcon} label="Department">
                  {employee.department}
                </HeaderChip>
              )}
              <HeaderChip icon={CalendarIcon} label="Dates shown">
                {filters.from || filters.to
                  ? `${formatDay(filters.from)} – ${formatDay(filters.to)}`
                  : 'All time'}
              </HeaderChip>
            </>
          }
          onBack={onBack}
          className="p-4"
        />
      </article>

      <div className="shrink-0">
        <AttendanceKpis
          totals={attendance.totals}
          status={filters.status}
          onStatus={(status) => attendance.setFilters({ status })}
        />
      </div>

      <div className="shrink-0">
        <AttendanceToolbar
          filters={filters}
          defaultRange={monthRange(month)}
          hasFilters={attendance.hasFilters}
          rangeProblem={attendance.rangeProblem}
          onChange={attendance.setFilters}
          onReset={attendance.resetFilters}
          actions={
            <div className="hidden md:block">
              <ColumnsMenu
                config={columnChoice.config}
                labelOf={(id) => ATTENDANCE_COLUMNS[id].label}
                onToggle={columnChoice.toggle}
                onMove={columnChoice.move}
                onReset={columnChoice.reset}
              />
            </div>
          }
        />
      </div>

      <section
        aria-label={`Attendance of ${name}`}
        className="border-border bg-bg relative flex flex-col overflow-hidden rounded-2xl border lg:min-h-[26rem] lg:flex-1 lg:basis-0"
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

        <AttendanceList
          items={attendance.items}
          columns={columnChoice.columns}
          isPending={attendance.isPending}
          error={attendance.error}
          hasFilters={attendance.hasFilters}
          isStale={attendance.isShowingPrevious}
          onRetry={attendance.retry}
          onClearFilters={attendance.resetFilters}
        />

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
