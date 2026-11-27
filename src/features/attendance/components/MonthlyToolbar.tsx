import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import {
  ChevronRightIcon,
  FilterIcon,
  SearchIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { SelectField } from '../../../components/ui/SelectField.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import {
  api,
  MONTHLY_ATTENDANCE_SORTS,
  type MonthlyAttendanceSort,
  type MonthRow,
} from '../../../lib/api/endpoints.ts'
import type { MonthlyFilters } from '../hooks/useMonthlyAttendance.ts'
import { humanize } from '../utils/format.ts'
import { currentMonth, monthOptions, shiftMonth } from '../utils/month.ts'
import { MemberFilter } from './MemberFilter.tsx'

const SORT_LABELS: Record<MonthlyAttendanceSort, string> = {
  name: 'Name',
  employee_code: 'Employee ID',
  total: 'Total hours',
}

const SQUARE_BUTTON =
  'border-border bg-bg text-text hover:border-accent inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-colors disabled:pointer-events-none disabled:opacity-40'
const TOOL_BUTTON =
  'flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'

/** The previous / next arrows around the month dropdown. */
function MonthPicker({
  month,
  onChange,
}: {
  month: string
  onChange: (month: string) => void
}) {
  const options = monthOptions()
  const oldest = options[options.length - 1].value
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Previous month"
        disabled={month <= oldest}
        onClick={() => onChange(shiftMonth(month, -1))}
        className={SQUARE_BUTTON}
      >
        <ChevronRightIcon width={16} height={16} className="rotate-180" />
      </button>
      <div className="w-44">
        <SelectField
          id="attendance-month"
          label="Month"
          hideLabel
          value={month}
          options={options}
          onChange={onChange}
        />
      </div>
      <button
        type="button"
        aria-label="Next month"
        disabled={month >= currentMonth()}
        onClick={() => onChange(shiftMonth(month, 1))}
        className={SQUARE_BUTTON}
      >
        <ChevronRightIcon width={16} height={16} />
      </button>
    </div>
  )
}

/**
 * The role choices: `GET /roles`, asked once the filters are open, together with the roles of the
 * rows on screen (so the choice still works for someone who may not read the roles).
 */
function RoleSelect({
  value,
  rows,
  onChange,
}: {
  value: string
  rows: MonthRow[]
  onChange: (role: string) => void
}) {
  const roles = useQuery({
    queryKey: ['attendance', 'roles'],
    queryFn: () => api.roles.list(),
    staleTime: 5 * 60_000,
  })
  const choices = new Map<string, string>()
  for (const role of roles.data ?? []) choices.set(role.name, role.label)
  for (const { employee } of rows) {
    if (employee.role && !choices.has(employee.role)) {
      choices.set(employee.role, employee.role_label || humanize(employee.role))
    }
  }
  if (value && !choices.has(value)) choices.set(value, humanize(value))

  return (
    <SelectField
      id="attendance-role"
      label="Role"
      compact
      value={value}
      options={[
        { value: '', label: 'All roles' },
        ...[...choices].map(([name, label]) => ({ value: name, label })),
      ]}
      onChange={onChange}
    />
  )
}

interface MonthlyToolbarProps {
  filters: MonthlyFilters
  /** The rows on screen. */
  rows: MonthRow[]
  /** May this person see other members? (the answer's `scope` isn't `own`). */
  isTeam: boolean
  hasFilters: boolean
  onChange: (changes: Partial<MonthlyFilters>) => void
  onReset: () => void
}

/**
 * The grid's toolbar: the month, then — for someone who sees the team — the search by name or
 * employee ID, the Member filter and the collapsed Filters grid (role and sorting).
 */
export function MonthlyToolbar({
  filters,
  rows,
  isTeam,
  hasFilters,
  onChange,
  onReset,
}: MonthlyToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useDebouncedField(filters.search, (value) =>
    onChange({ search: value }),
  )

  return (
    <section
      aria-label="Attendance filters"
      className="border-border bg-bg flex flex-col gap-3 rounded-2xl border p-3 sm:px-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <MonthPicker month={filters.month} onChange={(month) => onChange({ month })} />

        {isTeam ? (
          <>
            <div className="border-border bg-surface focus-within:border-accent flex h-11 min-w-56 flex-1 items-center gap-2 rounded-lg border px-3">
              <SearchIcon width={17} height={17} className="text-text-muted shrink-0" />
              <input
                type="search"
                aria-label="Search by name or employee ID"
                placeholder="Search by name or employee ID…"
                maxLength={80}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="text-text placeholder:text-text-muted min-w-0 flex-1 border-none bg-transparent text-[0.9rem] outline-none [&::-webkit-search-cancel-button]:hidden"
              />
            </div>
            <MemberFilter
              members={filters.members}
              onChange={(members) => onChange({ members })}
            />
            <button
              type="button"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
              className={`${TOOL_BUTTON} ${
                filtersOpen
                  ? 'border-accent bg-accent-tint text-accent'
                  : 'border-border bg-bg text-text hover:border-accent'
              }`}
            >
              <FilterIcon width={16} height={16} />
              Filters
            </button>
          </>
        ) : (
          <p className="text-text-muted flex-1 text-[0.85rem]">
            Your own attendance for the chosen month.
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            setSearch('')
            onReset()
          }}
          disabled={!hasFilters && search === ''}
          className={`${TOOL_BUTTON} bg-bg ${
            hasFilters
              ? 'border-danger text-danger hover:bg-danger-bg'
              : 'border-border text-text-muted hover:border-danger hover:text-danger'
          }`}
        >
          <XIcon width={14} height={14} />
          Clear All
        </button>
      </div>

      {isTeam && filtersOpen && (
        <div className="border-border grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-3 xl:grid-cols-5">
          <RoleSelect
            value={filters.role}
            rows={rows}
            onChange={(role) => onChange({ role })}
          />
          <SelectField
            id="attendance-sort"
            label="Sort by"
            compact
            value={filters.sort}
            options={MONTHLY_ATTENDANCE_SORTS.map((value) => ({
              value,
              label: SORT_LABELS[value],
            }))}
            onChange={(sort) => onChange({ sort: sort as MonthlyAttendanceSort })}
          />
          <SelectField
            id="attendance-order"
            label="Order"
            compact
            value={filters.order}
            options={[
              { value: 'asc', label: 'Ascending' },
              { value: 'desc', label: 'Descending' },
            ]}
            onChange={(order) => onChange({ order: order as 'asc' | 'desc' })}
          />
        </div>
      )}
    </section>
  )
}
