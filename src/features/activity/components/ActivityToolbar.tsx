import { useState } from 'react'
import {
  ArrowUpDownIcon,
  CalendarIcon,
  ChevronDownIcon,
  ListChecksIcon,
  SearchIcon,
  SlidersIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { DateRangePicker } from '../../../components/ui/DateRangePicker.tsx'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import {
  ACTIVITY_METHODS,
  type ActivityActionCount,
  type ActivityMethod,
} from '../../../lib/api/endpoints.ts'
import { toDateFilters, type ActivityFilters } from '../hooks/activityQueries.ts'
import { actionLabel } from '../utils/format.ts'

const FIELD_LABEL = 'text-text flex items-center gap-1.5 text-[0.82rem] font-semibold'

interface ActivityToolbarProps {
  filters: ActivityFilters
  actions: ActivityActionCount[]
  total: number | null
  hasFilters: boolean
  rangeInvalid: boolean
  onChange: (changes: Partial<ActivityFilters>) => void
  onReset: () => void
  /** The Filters grid was opened: load the dropdown choices now. */
  onWantOptions?: () => void
}

/**
 * Search, the Filters button and Clear All in one row, and the collapsible filter grid under
 * it (method — "All Methods (total)" — and action; the date range sits in the search row). Typing in the search box is
 * instant locally and sent to the API once the user pauses (see useDebouncedField);
 * dropdowns and dates apply immediately.
 */
export function ActivityToolbar({
  filters,
  actions,
  total,
  hasFilters,
  rangeInvalid,
  onChange,
  onReset,
  onWantOptions,
}: ActivityToolbarProps) {
  // Collapsed by default on every screen size; the Filters button reveals the grid.
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [search, setSearch] = useDebouncedField(filters.search, (search) =>
    onChange({ search }),
  )

  const actionOptions: SelectOption[] = [
    { value: '', label: 'All Actions' },
    ...actions.map((item) => ({
      value: item.action,
      label: `${actionLabel(item.action)} (${item.count.toLocaleString('en-GB')})`,
    })),
  ]
  // "All Methods" carries the list's total (the open choice's own number, no extra request: a
  // count per method would be one more request each, and every request is logged here).
  const methodOptions: SelectOption[] = [
    {
      value: '',
      label:
        total !== null && filters.method === ''
          ? `All Methods (${total.toLocaleString('en-GB')})`
          : 'All Methods',
    },
    ...ACTIVITY_METHODS.map((method) => ({ value: method, label: method })),
  ]
  // The chosen value is always listed, even before its list has loaded.
  if (filters.action && !actions.some((item) => item.action === filters.action)) {
    actionOptions.push({ value: filters.action, label: actionLabel(filters.action) })
  }

  return (
    <section
      aria-label="Activity filters"
      className="border-border bg-bg flex flex-col gap-4 rounded-2xl border p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="border-border bg-surface focus-within:border-accent focus-within:outline-accent-tint flex h-11 min-w-0 items-center gap-2.5 rounded-lg border px-3.5 transition-colors focus-within:outline-2 lg:flex-1">
          <SearchIcon className="text-text-muted shrink-0" />
          <input
            type="search"
            aria-label="Search activity"
            placeholder="Search the summary or path…"
            maxLength={200}
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

        <div className="flex flex-wrap items-center gap-3">
          <span className={`${FIELD_LABEL} whitespace-nowrap`}>
            <CalendarIcon width={16} height={16} className="text-text-muted" />
            Date
          </span>
          <div className="min-w-0">
            <DateRangePicker
              id="filter-dates"
              label="Date range"
              from={filters.from.slice(0, 10)}
              to={filters.to.slice(0, 10)}
              onChange={(range) => onChange(toDateFilters(range))}
            />
          </div>
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="activity-filter-grid"
            onClick={() => {
              if (!filtersOpen) onWantOptions?.()
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

      {rangeInvalid && (
        <p role="alert" className="text-danger text-[0.82rem] font-medium">
          The end of the date range is before its start — nothing can match.
        </p>
      )}

      <div
        id="activity-filter-grid"
        inert={!filtersOpen}
        className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
          filtersOpen ? 'grid-rows-[1fr] opacity-100' : '-mt-4 grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="-m-1 overflow-hidden p-1">
          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4">
            <SelectField
              id="filter-method"
              label="Method"
              icon={ArrowUpDownIcon}
              value={filters.method}
              options={methodOptions}
              onChange={(method) => onChange({ method: method as ActivityMethod | '' })}
            />
            <SelectField
              id="filter-action"
              label="Action"
              icon={ListChecksIcon}
              value={filters.action}
              options={actionOptions}
              onChange={(action) => onChange({ action })}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
