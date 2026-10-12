import { useState } from 'react'
import type {
  CustomerFilters,
  CustomersFacets,
} from '../../../app/store/customersSlice.ts'
import {
  ArrowUpDownIcon,
  ChevronDownIcon,
  DollarSignIcon,
  FilterIcon,
  MailIcon,
  OrdersIcon,
  SearchIcon,
  SlidersIcon,
  TagIcon,
  UsersIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import { useMediaQuery } from '../../../hooks/useMediaQuery.ts'
import {
  CUSTOMER_SORTS,
  type CustomerRole,
  type CustomerSort,
  type CustomerSource,
  type CustomerState,
} from '../../../lib/api/endpoints.ts'

const ROLE_TABS: { value: CustomerRole | ''; label: string }[] = [
  { value: '', label: 'All Customers' },
  { value: 'administrator', label: 'Administrators' },
  { value: 'subscriber', label: 'Subscribers' },
]

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
const SOURCE_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Sources' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'crm', label: 'Created in CRM' },
]
const STATE_OPTIONS: SelectOption[] = [
  { value: '', label: 'All States' },
  { value: 'ENABLED', label: 'Enabled' },
  { value: 'DISABLED', label: 'Disabled' },
  { value: 'INVITED', label: 'Invited' },
  { value: 'DECLINED', label: 'Declined' },
]
const MARKETING_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any' },
  { value: 'yes', label: 'Subscribed' },
  { value: 'no', label: 'Not subscribed' },
]
const ORDERS_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any' },
  { value: 'yes', label: 'Has orders' },
  { value: 'no', label: 'No orders' },
]

/** "All X" plus every value seen so far; the selected value is always listed. */
function withAll(allLabel: string, values: string[], selected: string): SelectOption[] {
  const list = selected && !values.includes(selected) ? [...values, selected] : values
  return [
    { value: '', label: allLabel },
    ...list.map((value) => ({ value, label: value })),
  ]
}

const FIELD_INPUT =
  'border-border bg-bg text-text focus:border-accent focus:outline-accent-tint h-10 w-full min-w-0 rounded-lg border px-3 text-[0.85rem] font-medium transition-colors outline-none focus:outline-2'

interface CustomersToolbarProps {
  filters: CustomerFilters
  facets: CustomersFacets
  total: number | null
  hasFilters: boolean
  onChange: (changes: Partial<CustomerFilters>) => void
  onReset: () => void
}

/**
 * Search, country, role tabs and the collapsible filter grid. Typing in the
 * search/spend boxes is instant locally and sent to the API once the user
 * pauses (see useDebouncedField); selects apply immediately.
 */
export function CustomersToolbar({
  filters,
  facets,
  total,
  hasFilters,
  onChange,
  onReset,
}: CustomersToolbarProps) {
  // Open by default on larger screens; on phones start collapsed so results are in view.
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [userOpen, setUserOpen] = useState<boolean | null>(null)
  const filtersOpen = userOpen ?? isDesktop

  const [search, setSearch] = useDebouncedField(filters.search, (search) =>
    onChange({ search }),
  )
  const [minSpent, setMinSpent] = useDebouncedField(filters.minSpent, (minSpent) =>
    onChange({ minSpent }),
  )
  const [maxSpent, setMaxSpent] = useDebouncedField(filters.maxSpent, (maxSpent) =>
    onChange({ maxSpent }),
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
          <div className="min-w-0 flex-1 lg:w-64 lg:flex-none">
            <SelectField
              inline
              id="filter-country"
              label="Country"
              value={filters.country}
              options={withAll('All Countries', facets.countries, filters.country)}
              onChange={(country) => onChange({ country })}
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
          aria-label="Filter by role"
          className="border-border bg-surface flex max-w-full min-w-0 [scrollbar-width:none] gap-1 overflow-x-auto rounded-xl border p-1 [&::-webkit-scrollbar]:hidden"
        >
          {ROLE_TABS.map((tab) => {
            const active = filters.role === tab.value
            return (
              <button
                key={tab.value}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ role: tab.value })}
                className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border-none px-3 py-1.5 text-[0.82rem] font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-bg text-text shadow-sm'
                    : 'text-text-muted hover:text-text bg-transparent'
                }`}
              >
                {tab.label}
                {active && total !== null && (
                  <span className="bg-accent-tint text-accent rounded-md px-1.5 py-0.5 text-[0.7rem] font-bold">
                    {total.toLocaleString('en-GB')}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="customer-filter-grid"
          onClick={() => setUserOpen(!filtersOpen)}
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

      <div
        id="customer-filter-grid"
        inert={!filtersOpen}
        className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
          filtersOpen ? 'grid-rows-[1fr] opacity-100' : '-mt-4 grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="-m-1 overflow-hidden p-1">
          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            <SelectField
              id="filter-source"
              label="Source"
              icon={UsersIcon}
              value={filters.source}
              options={SOURCE_OPTIONS}
              onChange={(source) => onChange({ source: source as CustomerSource | '' })}
            />
            <SelectField
              id="filter-state"
              label="Account State"
              icon={UsersIcon}
              value={filters.state}
              options={STATE_OPTIONS}
              onChange={(state) => onChange({ state: state as CustomerState | '' })}
            />
            <SelectField
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
              id="filter-tag"
              label="Tag"
              icon={TagIcon}
              value={filters.tag}
              options={withAll('All Tags', facets.tags, filters.tag)}
              onChange={(tag) => onChange({ tag })}
            />
            <div className="flex min-w-0 flex-col gap-1.5">
              <label
                htmlFor="filter-min-spent"
                className="text-text flex items-center gap-1.5 text-[0.82rem] font-semibold"
              >
                <DollarSignIcon width={16} height={16} className="text-text-muted" />
                Min spent
              </label>
              <input
                id="filter-min-spent"
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="0.00"
                value={minSpent}
                onChange={(event) => setMinSpent(event.target.value)}
                className={FIELD_INPUT}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label
                htmlFor="filter-max-spent"
                className="text-text flex items-center gap-1.5 text-[0.82rem] font-semibold"
              >
                <DollarSignIcon width={16} height={16} className="text-text-muted" />
                Max spent
              </label>
              <input
                id="filter-max-spent"
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="Any"
                value={maxSpent}
                onChange={(event) => setMaxSpent(event.target.value)}
                className={FIELD_INPUT}
              />
            </div>
            <SelectField
              id="filter-sort"
              label="Sort by"
              icon={ArrowUpDownIcon}
              value={filters.sort}
              options={SORT_OPTIONS}
              onChange={(sort) => onChange({ sort: sort as CustomerSort })}
            />
            <SelectField
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
