import { useState } from 'react'
import {
  BoxesIcon,
  CalendarIcon,
  ChevronDownIcon,
  FilterIcon,
  ListChecksIcon,
  RefreshIcon,
  SearchIcon,
  SlidersIcon,
  UsersIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { DateRangePicker } from '../../../components/ui/DateRangePicker.tsx'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import type { ActivityActionCount } from '../../../lib/api/endpoints.ts'
import { toDateFilters, type ActivityFilters } from '../hooks/activityQueries.ts'
import type { UserOption } from '../hooks/useActivityFilterOptions.ts'
import { actionLabel } from '../utils/format.ts'

const FIELD_LABEL = 'text-text flex items-center gap-1.5 text-[0.82rem] font-semibold'
const FIELD_INPUT =
  'border-border bg-bg text-text focus:border-accent focus:outline-accent-tint h-10 w-full min-w-0 rounded-lg border px-3 text-[0.85rem] font-medium transition-colors outline-none focus:outline-2'

interface ActivityToolbarProps {
  filters: ActivityFilters
  actions: ActivityActionCount[]
  users: UserOption[]
  total: number | null
  hasFilters: boolean
  rangeInvalid: boolean
  isRefreshing: boolean
  onChange: (changes: Partial<ActivityFilters>) => void
  onReset: () => void
  onRefresh: () => void
}

/**
 * Search, user dropdown, the total count and the collapsible filter grid (action,
 * entity, date range). Typing in the text boxes is instant locally and sent to
 * the API once the user pauses (see useDebouncedField); dropdowns and dates
 * apply immediately.
 */
export function ActivityToolbar({
  filters,
  actions,
  users,
  total,
  hasFilters,
  rangeInvalid,
  isRefreshing,
  onChange,
  onReset,
  onRefresh,
}: ActivityToolbarProps) {
  // Collapsed by default on every screen size; the Filters button reveals the grid.
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [search, setSearch] = useDebouncedField(filters.search, (search) =>
    onChange({ search }),
  )
  const [entityType, setEntityType] = useDebouncedField(
    filters.entityType,
    (entityType) => onChange({ entityType }),
  )
  const [entityId, setEntityId] = useDebouncedField(filters.entityId, (entityId) =>
    onChange({ entityId }),
  )

  const userOptions: SelectOption[] = [
    { value: '', label: 'All Users' },
    ...users.map((user) => ({ value: user.id, label: user.name })),
  ]
  const actionOptions: SelectOption[] = [
    { value: '', label: 'All Actions' },
    ...actions.map((item) => ({
      value: item.action,
      label: `${actionLabel(item.action)} (${item.count.toLocaleString('en-GB')})`,
    })),
  ]
  // The chosen value is always listed, even before its list has loaded.
  if (filters.userId && !users.some((user) => user.id === filters.userId)) {
    userOptions.push({ value: filters.userId, label: 'Selected user' })
  }
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

        <div className="flex items-center gap-3">
          <FilterIcon
            width={16}
            height={16}
            className="text-text-muted hidden sm:block"
          />
          <div className="min-w-0 flex-1 lg:w-64 lg:flex-none">
            <SelectField
              inline
              id="filter-user"
              label="User"
              value={filters.userId}
              options={userOptions}
              onChange={(userId) => onChange({ userId })}
            />
          </div>
          <button
            type="button"
            onClick={onReset}
            disabled={!hasFilters}
            className="border-border text-text-muted hover:text-danger hover:border-danger flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50"
          >
            <XIcon width={14} height={14} />
            Clear All
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="border-border bg-surface flex max-w-full min-w-0 gap-1 rounded-xl border p-1">
          <span className="bg-bg text-text flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-[0.82rem] font-semibold whitespace-nowrap shadow-sm">
            All Methods
            {total !== null && (
              <span className="bg-accent-tint text-accent rounded-md px-1.5 py-0.5 text-[0.7rem] font-bold">
                {total.toLocaleString('en-GB')}
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh activity"
            title="Refresh"
            className="border-border bg-bg text-text hover:border-accent flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-colors disabled:pointer-events-none disabled:opacity-60"
          >
            <RefreshIcon
              width={16}
              height={16}
              className={isRefreshing ? 'animate-spin' : ''}
            />
          </button>
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="activity-filter-grid"
            onClick={() => setFiltersOpen(!filtersOpen)}
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
          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            <SelectField
              id="filter-action"
              label="Action"
              icon={ListChecksIcon}
              value={filters.action}
              options={actionOptions}
              onChange={(action) => onChange({ action })}
            />
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="filter-entity-type" className={FIELD_LABEL}>
                <BoxesIcon width={16} height={16} className="text-text-muted" />
                Entity type
              </label>
              <input
                id="filter-entity-type"
                maxLength={60}
                placeholder="e.g. user"
                value={entityType}
                onChange={(event) => setEntityType(event.target.value)}
                className={FIELD_INPUT}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="filter-entity-id" className={FIELD_LABEL}>
                <UsersIcon width={16} height={16} className="text-text-muted" />
                Entity ID
              </label>
              <input
                id="filter-entity-id"
                maxLength={120}
                placeholder="Any"
                value={entityId}
                onChange={(event) => setEntityId(event.target.value)}
                className={FIELD_INPUT}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <span id="filter-dates-label" className={FIELD_LABEL}>
                <CalendarIcon width={16} height={16} className="text-text-muted" />
                Date range
              </span>
              <DateRangePicker
                id="filter-dates"
                label="Date range"
                from={filters.from.slice(0, 10)}
                to={filters.to.slice(0, 10)}
                onChange={(range) => onChange(toDateFilters(range))}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
