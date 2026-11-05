import { useState } from 'react'
import type { CustomerFilters } from '../../../app/store/customersSlice.ts'
import {
  ArrowUpDownIcon,
  ChevronDownIcon,
  FilterIcon,
  OrdersIcon,
  SearchIcon,
  SlidersIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import { ORDERS_OPTIONS } from '../utils/filterOptions.ts'
import type { CustomerSort } from '../../../lib/api/endpoints.ts'

const SORT_CHOICES: { value: CustomerSort; label: string }[] = [
  { value: 'created_at', label: 'Date created' },
  { value: 'updated_at', label: 'Last updated' },
  { value: 'name', label: 'Name' },
  { value: 'email', label: 'Email' },
  { value: 'orders_count', label: 'Orders' },
]
const SORT_OPTIONS: SelectOption[] = SORT_CHOICES
const ORDER_OPTIONS: SelectOption[] = [
  { value: 'desc', label: 'Descending' },
  { value: 'asc', label: 'Ascending' },
]

interface CustomersToolbarProps {
  filters: CustomerFilters
  hasFilters: boolean
  onChange: (changes: Partial<CustomerFilters>) => void
  onReset: () => void
}

/**
 * Search, the Filters button and Clear All in one row, and the collapsible
 * filter grid under it. Typing in the search box is instant locally and sent to the API once
 * the user pauses (see useDebouncedField); selects apply immediately.
 */
export function CustomersToolbar({
  filters,
  hasFilters,
  onChange,
  onReset,
}: CustomersToolbarProps) {
  // Collapsed by default on every screen size; the Filters button reveals the grid.
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useDebouncedField(filters.search, (search) =>
    onChange({ search }),
  )

  return (
    <section
      aria-label="Customer filters"
      className="border-border bg-bg flex flex-col gap-4 rounded-2xl border p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="border-border bg-surface focus-within:border-accent focus-within:outline-accent-tint flex h-11 min-w-0 items-center gap-2.5 rounded-lg border px-3.5 transition-colors focus-within:outline-2 lg:flex-1">
          <SearchIcon className="text-text-muted shrink-0" />
          <input
            type="search"
            aria-label="Search customers"
            placeholder="Smart Search: name, email, phone, company, tag…"
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
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="customer-filter-grid"
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
        </div>
      </div>

      <div
        id="customer-filter-grid"
        inert={!filtersOpen}
        className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
          filtersOpen ? 'grid-rows-[1fr] opacity-100' : '-mt-4 grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="-m-1 overflow-hidden p-1">
          <div className="grid grid-cols-2 gap-3 min-[560px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-9">
            <SelectField
              compact
              id="filter-orders"
              label="Orders"
              icon={OrdersIcon}
              value={filters.orders}
              options={ORDERS_OPTIONS}
              onChange={(orders) =>
                onChange({ orders: orders as CustomerFilters['orders'] })
              }
            />
            <SelectField
              compact
              id="filter-sort"
              label="Sort by"
              icon={ArrowUpDownIcon}
              value={filters.sort}
              options={SORT_OPTIONS}
              onChange={(sort) => onChange({ sort: sort as CustomerSort })}
            />
            <SelectField
              compact
              id="filter-order"
              label="Order"
              value={filters.order}
              options={ORDER_OPTIONS}
              onChange={(order) => onChange({ order: order as CustomerFilters['order'] })}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
