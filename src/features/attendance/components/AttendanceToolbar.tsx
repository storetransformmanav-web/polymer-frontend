import { useState } from 'react'
import {
  CalendarIcon,
  ChevronDownIcon,
  SearchIcon,
  SlidersIcon,
  UserCogIcon,
  UsersIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { DateRangePicker } from '../../../components/ui/DateRangePicker.tsx'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import {
  ATTENDANCE_STATUSES,
  type Role,
  type UserItem,
} from '../../../lib/api/endpoints.ts'
import type { AttendanceFilters } from '../hooks/useAttendance.ts'
import { currentMonthRange, STATUS_OPTION_LABELS } from '../utils/format.ts'

const FIELD_LABEL = 'text-text flex items-center gap-1.5 text-[0.82rem] font-semibold'

const personLabel = (
  user: Pick<UserItem, 'full_name' | 'first_name' | 'last_name' | 'email'>,
) => {
  const name =
    user.full_name.trim() ||
    [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
  return name ? `${name} (${user.email})` : user.email
}

interface AttendanceToolbarProps {
  filters: AttendanceFilters
  /** An administrator can search, and filter by employee and role; anyone else only by dates and status. */
  isAdmin: boolean
  users: UserItem[]
  roles: Role[]
  hasFilters: boolean
  rangeProblem: string | null
  onChange: (changes: Partial<AttendanceFilters>) => void
  onReset: () => void
  /** The Filters grid was opened: load the dropdown choices now. */
  onWantOptions?: () => void
}

/**
 * The search row (search box — administrators only —, the date range, Filters and Clear All) and the
 * collapsible grid under it, laid out like the Products and Activity pages. Typing is local until
 * the user pauses (`useDebouncedField`); dropdowns and dates apply at once.
 */
export function AttendanceToolbar({
  filters,
  isAdmin,
  users,
  roles,
  hasFilters,
  rangeProblem,
  onChange,
  onReset,
  onWantOptions,
}: AttendanceToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useDebouncedField(filters.search, (value) =>
    onChange({ search: value }),
  )

  const statusOptions: SelectOption[] = [
    { value: '', label: 'All statuses' },
    ...ATTENDANCE_STATUSES.map((status) => ({
      value: status,
      label: STATUS_OPTION_LABELS[status] ?? status,
    })),
  ]
  const userOptions: SelectOption[] = [
    { value: '', label: 'All employees' },
    ...users.map((user) => ({ value: user.id, label: personLabel(user) })),
  ]
  if (filters.employee && !users.some((user) => user.id === filters.employee)) {
    userOptions.push({ value: filters.employee, label: filters.employee })
  }
  const roleOptions: SelectOption[] = [
    { value: '', label: 'All roles' },
    ...roles.map((role) => ({ value: role.name, label: role.label || role.name })),
  ]
  if (filters.role && !roles.some((role) => role.name === filters.role)) {
    roleOptions.push({ value: filters.role, label: filters.role })
  }

  return (
    <section
      aria-label="Attendance filters"
      className="border-border bg-bg flex flex-col gap-4 rounded-2xl border p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {isAdmin ? (
          <div className="border-border bg-surface focus-within:border-accent focus-within:outline-accent-tint flex h-11 min-w-0 items-center gap-2.5 rounded-lg border px-3.5 transition-colors focus-within:outline-2 lg:flex-1">
            <SearchIcon className="text-text-muted shrink-0" />
            <input
              type="search"
              aria-label="Search attendance"
              placeholder="Search by employee name or ID…"
              maxLength={80}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="text-text placeholder:text-text-muted min-w-0 flex-1 border-none bg-transparent text-[0.9rem] outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch('')}
                className="text-text-muted hover:text-text cursor-pointer border-none bg-none p-0.5"
              >
                <XIcon width={16} height={16} />
              </button>
            )}
          </div>
        ) : (
          <p className="text-text-muted text-[0.85rem] lg:flex-1">
            Your own attendance for the chosen dates.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <span className={`${FIELD_LABEL} whitespace-nowrap`}>
            <CalendarIcon width={16} height={16} className="text-text-muted" />
            Date
          </span>
          <div className="min-w-0">
            <DateRangePicker
              id="attendance-dates"
              label="Date range"
              from={filters.from}
              to={filters.to}
              onChange={(range) =>
                // "All Time" has no meaning here (the API reads at most 93 days): back to this month.
                onChange(range.from && range.to ? range : currentMonthRange())
              }
            />
          </div>
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="attendance-filter-grid"
            onClick={() => {
              if (!filtersOpen && isAdmin) onWantOptions?.()
              setFiltersOpen(!filtersOpen)
            }}
            className="border-border bg-bg text-text hover:border-accent flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3.5 text-[0.82rem] font-semibold transition-colors"
          >
            <SlidersIcon width={16} height={16} />
            Filters
            <ChevronDownIcon
              width={14}
              height={14}
              className={`transition-transform duration-200 ${filtersOpen ? 'rotate-180' : ''}`}
            />
          </button>
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
        </div>
      </div>

      {rangeProblem && (
        <p role="alert" className="text-danger text-[0.82rem] font-medium">
          {rangeProblem}
        </p>
      )}

      <div
        id="attendance-filter-grid"
        inert={!filtersOpen}
        className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
          filtersOpen ? 'grid-rows-[1fr] opacity-100' : '-mt-4 grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="-m-1 overflow-hidden p-1">
          <div
            className={`grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 ${
              isAdmin ? 'xl:grid-cols-3' : 'xl:grid-cols-2'
            }`}
          >
            <SelectField
              id="attendance-status"
              label="Status"
              compact
              value={filters.status}
              options={statusOptions}
              onChange={(status) =>
                onChange({ status: status as AttendanceFilters['status'] })
              }
            />
            {isAdmin && (
              <>
                <SelectField
                  id="attendance-employee"
                  label="Employee"
                  icon={UsersIcon}
                  compact
                  value={filters.employee}
                  options={userOptions}
                  onChange={(employee) => onChange({ employee })}
                />
                <SelectField
                  id="attendance-role"
                  label="Role"
                  icon={UserCogIcon}
                  compact
                  value={filters.role}
                  options={roleOptions}
                  onChange={(role) => onChange({ role })}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
