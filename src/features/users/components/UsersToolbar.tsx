import { useState } from 'react'
import {
  ChevronDownIcon,
  ListChecksIcon,
  SearchIcon,
  SlidersIcon,
  UserCogIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import type { Role } from '../../../lib/api/endpoints.ts'
import { useUserStatusCounts } from '../hooks/useUserStatusCounts.ts'
import type { UserFilters } from '../hooks/useUsers.ts'

const STATUS_CHOICES: { value: UserFilters['status']; label: string }[] = [
  { value: '', label: 'All Users' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const STATUS_VALUES = STATUS_CHOICES.map((choice) => choice.value)

interface UsersToolbarProps {
  filters: UserFilters
  roles: Role[]
  total: number | null
  hasFilters: boolean
  onChange: (changes: Partial<UserFilters>) => void
  onReset: () => void
}

/**
 * Search, the Filters button and Clear All in one row, and the collapsible filter grid
 * under it: **Status** (with a count on every choice) and **Role**. Typing in the search
 * box is instant locally and sent to the API once the user pauses (see
 * useDebouncedField); the dropdowns apply immediately.
 */
export function UsersToolbar({
  filters,
  roles,
  total,
  hasFilters,
  onChange,
  onReset,
}: UsersToolbarProps) {
  // Collapsed by default on every screen size; the Filters button reveals the grid.
  const [filtersOpen, setFiltersOpen] = useState(false)
  // The counts are only shown in the status dropdown, so they are requested once the grid is open.
  const counts = useUserStatusCounts(filters, STATUS_VALUES, filtersOpen)
  const [search, setSearch] = useDebouncedField(filters.search, (search) =>
    onChange({ search }),
  )

  // The status choices, each with its count ("Active (48)"). The open one can fall back to
  // the list's own total while its count loads.
  const statusOptions: SelectOption[] = STATUS_CHOICES.map((choice) => {
    const count = counts[choice.value] ?? (filters.status === choice.value ? total : null)
    return {
      value: choice.value,
      label:
        count === null
          ? choice.label
          : `${choice.label} (${count.toLocaleString('en-GB')})`,
    }
  })

  // "All roles" plus every role the backend knows; the selected one is always listed.
  const roleOptions: SelectOption[] = [
    { value: '', label: 'All Roles' },
    ...roles.map((role) => ({ value: role.name, label: role.label })),
  ]
  if (filters.role && !roles.some((role) => role.name === filters.role)) {
    roleOptions.push({ value: filters.role, label: filters.role })
  }

  return (
    <section
      aria-label="User filters"
      className="border-border bg-bg flex flex-col gap-4 rounded-2xl border p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="border-border bg-surface focus-within:border-accent focus-within:outline-accent-tint flex h-11 min-w-0 items-center gap-2.5 rounded-lg border px-3.5 transition-colors focus-within:outline-2 lg:flex-1">
          <SearchIcon className="text-text-muted shrink-0" />
          <input
            type="search"
            aria-label="Search users"
            placeholder="Search by name or email…"
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
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="user-filter-grid"
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

      <div
        id="user-filter-grid"
        inert={!filtersOpen}
        className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
          filtersOpen ? 'grid-rows-[1fr] opacity-100' : '-mt-4 grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="-m-1 overflow-hidden p-1">
          <div className="grid grid-cols-2 gap-3 min-[560px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            <SelectField
              compact
              id="filter-status"
              label="User status"
              icon={ListChecksIcon}
              value={filters.status}
              options={statusOptions}
              onChange={(status) => onChange({ status: status as UserFilters['status'] })}
            />
            <SelectField
              compact
              id="filter-role"
              label="Role"
              icon={UserCogIcon}
              value={filters.role}
              options={roleOptions}
              onChange={(role) => onChange({ role })}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
