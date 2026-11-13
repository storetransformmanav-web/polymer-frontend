import { useState, type ReactNode } from 'react'
import {
  ArrowUpDownIcon,
  ChevronDownIcon,
  LayersIcon,
  SearchIcon,
  SlidersIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import type { CollectionFilters } from '../hooks/useCollections.ts'

const TYPE_OPTIONS: SelectOption[] = [
  { value: '', label: 'All collections' },
  { value: 'custom', label: 'Manual' },
  { value: 'smart', label: 'Automated' },
]

const SORT_OPTIONS: SelectOption[] = [
  { value: 'title', label: 'Title' },
  { value: 'products', label: 'Products' },
  { value: 'updated', label: 'Last updated' },
]

const ORDER_OPTIONS: SelectOption[] = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
]

interface CollectionsToolbarProps {
  filters: CollectionFilters
  hasFilters: boolean
  onChange: (changes: Partial<CollectionFilters>) => void
  onReset: () => void
  /** The page's own buttons (Add collection), at the end of the search row. */
  actions?: ReactNode
}

/**
 * Search (name or handle), the Filters button, Clear All and the page's actions in one row, with
 * the collapsible filter grid under it — type (Manual / Automated), sort and order. Typing is
 * instant locally and sent to the API once the user pauses.
 */
export function CollectionsToolbar({
  filters,
  hasFilters,
  onChange,
  onReset,
  actions,
}: CollectionsToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useDebouncedField(filters.search, (value) =>
    onChange({ search: value }),
  )

  return (
    <section
      aria-label="Collection filters"
      className="border-border bg-bg flex flex-col gap-4 rounded-2xl border p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="border-border bg-surface focus-within:border-accent focus-within:outline-accent-tint flex h-11 min-w-0 items-center gap-2.5 rounded-lg border px-3.5 transition-colors focus-within:outline-2 lg:flex-1">
          <SearchIcon className="text-text-muted shrink-0" />
          <input
            type="search"
            aria-label="Search collections"
            placeholder="Search by collection name or handle…"
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
            aria-controls="collection-filter-grid"
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
        id="collection-filter-grid"
        inert={!filtersOpen}
        className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
          filtersOpen ? 'grid-rows-[1fr] opacity-100' : '-mt-4 grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="-m-1 overflow-hidden p-1">
          <div className="grid grid-cols-2 gap-3 min-[560px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            <SelectField
              compact
              id="collection-filter-type"
              label="Collection type"
              icon={LayersIcon}
              value={filters.type}
              options={TYPE_OPTIONS}
              onChange={(type) => onChange({ type: type as CollectionFilters['type'] })}
            />
            <SelectField
              compact
              id="collection-filter-sort"
              label="Sort by"
              icon={ArrowUpDownIcon}
              value={filters.sort}
              options={SORT_OPTIONS}
              onChange={(sort) => onChange({ sort: sort as CollectionFilters['sort'] })}
            />
            <SelectField
              compact
              id="collection-filter-order"
              label="Order"
              icon={ArrowUpDownIcon}
              value={filters.order}
              options={ORDER_OPTIONS}
              onChange={(order) =>
                onChange({ order: order as CollectionFilters['order'] })
              }
            />
          </div>
        </div>
      </div>
    </section>
  )
}
