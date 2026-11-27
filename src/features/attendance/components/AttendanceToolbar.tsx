import type { ReactNode } from 'react'
import { CalendarIcon, XIcon } from '../../../components/ui/icons.tsx'
import { DateRangePicker } from '../../../components/ui/DateRangePicker.tsx'
import type { AttendanceFilters } from '../hooks/useAttendance.ts'
import { ATTENDANCE_RANGE_PRESETS } from '../utils/format.ts'

const FIELD_LABEL = 'text-text flex items-center gap-1.5 text-[0.82rem] font-semibold'

interface AttendanceToolbarProps {
  filters: AttendanceFilters
  /** What one date on its own goes back to. */
  defaultRange: { from: string; to: string }
  hasFilters: boolean
  rangeProblem: string | null
  onChange: (changes: Partial<AttendanceFilters>) => void
  onReset: () => void
  /** Extra controls at the end of the row (the Columns menu). */
  actions?: ReactNode
}

/** One employee's toolbar: the date range, Clear All and the Columns menu. Dates apply at once. */
export function AttendanceToolbar({
  filters,
  defaultRange,
  hasFilters,
  rangeProblem,
  onChange,
  onReset,
  actions,
}: AttendanceToolbarProps) {
  return (
    <section
      aria-label="Attendance filters"
      className="border-border bg-bg flex flex-col gap-3 rounded-2xl border p-3 sm:px-4"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`${FIELD_LABEL} whitespace-nowrap`}>
            <CalendarIcon width={16} height={16} className="text-text-muted" />
            Date
          </span>
          <div className="min-w-0">
            <DateRangePicker
              id="attendance-dates"
              label="Date range"
              presets={ATTENDANCE_RANGE_PRESETS}
              from={filters.from}
              to={filters.to}
              onChange={(range) =>
                // Both empty is "All Time"; one date on its own goes back to the opened month.
                onChange(Boolean(range.from) === Boolean(range.to) ? range : defaultRange)
              }
            />
          </div>
          <button
            type="button"
            onClick={onReset}
            disabled={!hasFilters}
            className={`flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 ${
              hasFilters
                ? 'border-danger text-danger hover:bg-danger-bg'
                : 'border-border text-text-muted hover:border-danger hover:text-danger'
            }`}
          >
            <XIcon width={14} height={14} />
            Clear All
          </button>
          {actions}
        </div>
      </div>

      {rangeProblem && (
        <p role="alert" className="text-danger text-[0.82rem] font-medium">
          {rangeProblem}
        </p>
      )}
    </section>
  )
}
