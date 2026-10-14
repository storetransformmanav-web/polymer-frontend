import { Button } from '../../../components/ui/Button.tsx'
import { FilterIcon, PlusIcon, SearchIcon, XIcon } from '../../../components/ui/icons.tsx'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import type { Role } from '../../../lib/api/endpoints.ts'
import { useUserStatusCounts } from '../hooks/useUserStatusCounts.ts'
import type { UserFilters } from '../hooks/useUsers.ts'

const STATUS_TABS: { value: UserFilters['status']; label: string }[] = [
  { value: '', label: 'All Users' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const STATUS_VALUES = STATUS_TABS.map((tab) => tab.value)

interface UsersToolbarProps {
  filters: UserFilters
  roles: Role[]
  total: number | null
  hasFilters: boolean
  onChange: (changes: Partial<UserFilters>) => void
  onReset: () => void
  onAdd: () => void
}

/**
 * Search, role dropdown, status tabs and the "Add user" button. Typing in the
 * search box is instant locally and sent to the API once the user pauses
 * (see useDebouncedField); the dropdown and tabs apply immediately.
 */
export function UsersToolbar({
  filters,
  roles,
  total,
  hasFilters,
  onChange,
  onReset,
  onAdd,
}: UsersToolbarProps) {
  const counts = useUserStatusCounts(filters, STATUS_VALUES)
  const [search, setSearch] = useDebouncedField(filters.search, (search) =>
    onChange({ search }),
  )

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

        <div className="flex items-center gap-3">
          <FilterIcon
            width={16}
            height={16}
            className="text-text-muted hidden sm:block"
          />
          <div className="min-w-0 flex-1 lg:w-64 lg:flex-none">
            <SelectField
              inline
              id="filter-role"
              label="Role"
              value={filters.role}
              options={roleOptions}
              onChange={(role) => onChange({ role })}
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
        <div
          role="group"
          aria-label="Filter by status"
          className="border-border bg-surface flex max-w-full min-w-0 [scrollbar-width:none] gap-1 overflow-x-auto rounded-xl border p-1 [&::-webkit-scrollbar]:hidden"
        >
          {STATUS_TABS.map((tab) => {
            const active = filters.status === tab.value
            // The open tab can fall back to the list's own total while its count loads.
            const count = counts[tab.value] ?? (active ? total : null)
            return (
              <button
                key={tab.value}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ status: tab.value })}
                className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border-none px-3 py-1.5 text-[0.82rem] font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-bg text-text shadow-sm'
                    : 'text-text-muted hover:text-text bg-transparent'
                }`}
              >
                {tab.label}
                {count !== null && (
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[0.7rem] font-bold ${
                      active
                        ? 'bg-accent-tint text-accent'
                        : 'bg-border/60 text-text-muted'
                    }`}
                  >
                    {count.toLocaleString('en-GB')}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <Button
          type="button"
          onClick={onAdd}
          className="h-10 rounded-lg px-4 text-[0.82rem]"
        >
          <PlusIcon width={16} height={16} />
          Add user
        </Button>
      </div>
    </section>
  )
}
