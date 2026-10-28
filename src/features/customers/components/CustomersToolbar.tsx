import { useState } from 'react'
import type { CustomerFilters } from '../../../app/store/customersSlice.ts'
import {
  ArrowUpDownIcon,
  ChevronDownIcon,
  FilterIcon,
  MailIcon,
  OrdersIcon,
  SearchIcon,
  SlidersIcon,
  UserCogIcon,
  UsersIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import { useCustomerRoleCounts } from '../hooks/useCustomerRoleCounts.ts'
import {
  MARKETING_OPTIONS,
  ORDERS_OPTIONS,
  STATE_OPTIONS,
} from '../utils/filterOptions.ts'
import {
  CUSTOMER_SORTS,
  type CustomerRole,
  type CustomerSort,
  type CustomerState,
} from '../../../lib/api/endpoints.ts'

const ROLE_TABS: { value: CustomerRole | ''; label: string }[] = [
  { value: '', label: 'All Customers' },
  { value: 'administrator', label: 'Administrators' },
  { value: 'subscriber', label: 'Subscribers' },
]

const ROLE_VALUES = ROLE_TABS.map((tab) => tab.value)

const SORT_LABELS: Record<CustomerSort, string> = {
  created_at: 'Date created',
  updated_at: 'Last updated',
  name: 'Name',
  email: 'Email',
  orders_count: 'Orders',
  total_spent: 'Total spent',
  last_login: 'Last login',
}

const SORT_OPTIONS: SelectOption[] = CUSTOMER_SORTS.map((value) => ({
  value,
  label: SORT_LABELS[value],
}))
const ORDER_OPTIONS: SelectOption[] = [
  { value: 'desc', label: 'Descending' },
  { value: 'asc', label: 'Ascending' },
]

interface CustomersToolbarProps {
  filters: CustomerFilters
  total: number | null
  hasFilters: boolean
  onChange: (changes: Partial<CustomerFilters>) => void
  onReset: () => void
}

/**
 * Search, the Filters button and Clear All in one row, and the collapsible
 * filter grid under it (its first field is the role, with a count on every choice). Typing in the
 * search box is instant locally and sent to the API once the user
 * pauses (see useDebouncedField); selects apply immediately.
 */
export function CustomersToolbar({
  filters,
  total,
  hasFilters,
  onChange,
  onReset,
}: CustomersToolbarProps) {
  // Collapsed by default on every screen size; the Filters button reveals the grid.
  const [filtersOpen, setFiltersOpen] = useState(false)
  // The counts are only shown in the dropdown, so they are requested once the grid is open.
  const counts = useCustomerRoleCounts(filters, ROLE_VALUES, filtersOpen)

  // The role choices, each with its count ("Subscribers (9,760)"). The open one can fall
  // back to the list's own total while its count loads.
  const roleOptions: SelectOption[] = ROLE_TABS.map((tab) => {
    const count = counts[tab.value] ?? (filters.role === tab.value ? total : null)
    return {
      value: tab.value,
      label:
        count === null ? tab.label : `${tab.label} (${count.toLocaleString('en-GB')})`,
    }
  })

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
              id="filter-role"
              label="Customer role"
              icon={UserCogIcon}
              value={filters.role}
              options={roleOptions}
              onChange={(role) => onChange({ role: role as CustomerRole | '' })}
            />
            <SelectField
              compact
              id="filter-state"
              label="Account State"
              icon={UsersIcon}
              value={filters.state}
              options={STATE_OPTIONS}
              onChange={(state) => onChange({ state: state as CustomerState | '' })}
            />
            <SelectField
              compact
              id="filter-marketing"
              label="Marketing"
              icon={MailIcon}
              value={filters.marketing}
              options={MARKETING_OPTIONS}
              onChange={(marketing) =>
                onChange({ marketing: marketing as CustomerFilters['marketing'] })
              }
            />
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
