import { useState, type ReactNode } from 'react'
import {
  ArrowUpDownIcon,
  ChevronDownIcon,
  ListChecksIcon,
  RefreshIcon,
  SearchIcon,
  SlidersIcon,
  TagIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import { useAccessTags } from '../hooks/usePickers.ts'
import type { LockFilters } from '../hooks/useLocks.ts'

const STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'All locks' },
  { value: 'enabled', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' },
]

const SYNC_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any state' },
  { value: 'synced', label: 'Synced' },
  { value: 'pending', label: 'Pending' },
  { value: 'error', label: 'Needs attention' },
]

const SORT_OPTIONS: SelectOption[] = [
  { value: 'updated_at', label: 'Recently updated' },
  { value: 'title', label: 'Product name' },
  { value: 'sync_status', label: 'Shopify state' },
]

interface LocksToolbarProps {
  shop: string
  filters: LockFilters
  hasFilters: boolean
  onChange: (changes: Partial<LockFilters>) => void
  onReset: () => void
  /** The page's own buttons (Add lock, Set up store), at the right of the search row. */
  actions?: ReactNode
}

/**
 * Search, the Filters button, Clear All and the page's actions in one row, with the
 * collapsible filter grid under it: lock status, Shopify state, tag (the store's lock tags —
 * requested only once the grid is opened) and sort order. Typing in the search box is instant
 * locally and sent to the API once the user pauses.
 */
export function LocksToolbar({
  shop,
  filters,
  hasFilters,
  onChange,
  onReset,
  actions,
}: LocksToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useDebouncedField(filters.search, (value) =>
    onChange({ search: value }),
  )
  // The tag choices are only needed inside the dropdown, so they load once the grid opens.
  const tags = useAccessTags(shop, '', { lockOnly: true, enabled: filtersOpen })

  const tagOptions: SelectOption[] = [
    { value: '', label: 'Any tag' },
    ...tags.items.map((item) => ({ value: item.tag, label: item.label || item.tag })),
  ]
  if (filters.tag && !tags.items.some((item) => item.tag === filters.tag)) {
    tagOptions.push({ value: filters.tag, label: filters.tag })
  }

  return (
    <section
      aria-label="Lock filters"
      className="border-border bg-bg flex flex-col gap-4 rounded-2xl border p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="border-border bg-surface focus-within:border-accent focus-within:outline-accent-tint flex h-11 min-w-0 items-center gap-2.5 rounded-lg border px-3.5 transition-colors focus-within:outline-2 lg:flex-1">
          <SearchIcon className="text-text-muted shrink-0" />
          <input
            type="search"
            aria-label="Search locks"
            placeholder="Search by product name or handle…"
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
            aria-controls="lock-filter-grid"
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

      <div
        id="lock-filter-grid"
        inert={!filtersOpen}
        className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
          filtersOpen ? 'grid-rows-[1fr] opacity-100' : '-mt-4 grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="-m-1 overflow-hidden p-1">
          <div className="grid grid-cols-2 gap-3 min-[560px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            <SelectField
              compact
              id="filter-lock-status"
              label="Lock status"
              icon={ListChecksIcon}
              value={filters.status}
              options={STATUS_OPTIONS}
              onChange={(status) => onChange({ status: status as LockFilters['status'] })}
            />
            <SelectField
              compact
              id="filter-lock-sync"
              label="Shopify state"
              icon={RefreshIcon}
              value={filters.sync}
              options={SYNC_OPTIONS}
              onChange={(sync) => onChange({ sync: sync as LockFilters['sync'] })}
            />
            <SelectField
              compact
              id="filter-lock-tag"
              label="Tag"
              icon={TagIcon}
              value={filters.tag}
              options={tagOptions}
              onChange={(tag) => onChange({ tag })}
            />
            <SelectField
              compact
              id="filter-lock-sort"
              label="Sort by"
              icon={ArrowUpDownIcon}
              value={filters.sort}
              options={SORT_OPTIONS}
              onChange={(sort) => onChange({ sort: sort as LockFilters['sort'] })}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
