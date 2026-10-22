import { useState } from 'react'
import type { OrderFilters, OrdersFacets } from '../../../app/store/ordersSlice.ts'
import { DateRangePicker } from '../../../components/ui/DateRangePicker.tsx'
import {
  ArrowUpDownIcon,
  BoxesIcon,
  CalendarIcon,
  ChevronDownIcon,
  DollarSignIcon,
  OrdersIcon,
  SearchIcon,
  SlidersIcon,
  TagIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { withAll } from '../../../components/ui/selectOptions.ts'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import {
  ORDER_FINANCIAL_STATUSES,
  ORDER_SORTS,
  ORDER_SOURCES,
  type OrderFinancialStatus,
  type OrderFulfillmentStatus,
  type OrderSort,
  type OrderSource,
} from '../../../lib/api/endpoints.ts'
import { useOrderFulfillmentCounts } from '../hooks/useOrderFulfillmentCounts.ts'
import { humanize, sourceLabel } from '../utils/format.ts'

const FULFILLMENT_TABS: { value: OrderFulfillmentStatus | ''; label: string }[] = [
  { value: '', label: 'All Orders' },
  { value: 'UNFULFILLED', label: 'Unfulfilled' },
  { value: 'PARTIALLY_FULFILLED', label: 'Partially fulfilled' },
  { value: 'FULFILLED', label: 'Fulfilled' },
  { value: 'ON_HOLD', label: 'On hold' },
]
const FULFILLMENT_VALUES = FULFILLMENT_TABS.map((tab) => tab.value)

const SORT_LABELS: Record<OrderSort, string> = {
  created_at: 'Date created',
  updated_at: 'Last updated',
  total: 'Total',
  name: 'Order number',
  customer: 'Customer',
}
const SORT_OPTIONS: SelectOption[] = ORDER_SORTS.map((value) => ({
  value,
  label: SORT_LABELS[value],
}))
const ORDER_OPTIONS: SelectOption[] = [
  { value: 'desc', label: 'Descending' },
  { value: 'asc', label: 'Ascending' },
]
const PAYMENT_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Payments' },
  ...ORDER_FINANCIAL_STATUSES.map((value) => ({ value, label: humanize(value) })),
]
const SOURCE_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Sources' },
  ...ORDER_SOURCES.map((value) => ({ value, label: sourceLabel(value) })),
]
const CANCELLED_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any' },
  { value: 'no', label: 'Not cancelled' },
  { value: 'yes', label: 'Cancelled' },
]

const FIELD_INPUT =
  'border-border bg-bg text-text focus:border-accent focus:outline-accent-tint h-10 w-full min-w-0 rounded-lg border px-3 text-[0.85rem] font-medium transition-colors outline-none focus:outline-2'
const FIELD_LABEL = 'text-text flex items-center gap-1.5 text-[0.82rem] font-semibold'

interface OrdersToolbarProps {
  filters: OrderFilters
  facets: OrdersFacets
  total: number | null
  hasFilters: boolean
  onChange: (changes: Partial<OrderFilters>) => void
  onReset: () => void
}

/**
 * One card, like the products list: the search row — search box, **Order Date** range,
 * Clear All — then the fulfillment tabs (the same segmented pill group as the products'
 * status tabs, each with its count) beside the Filters button, with the collapsible grid
 * of selects under it. Typing in the search/total boxes is instant locally and sent to the
 * API once the user pauses (see useDebouncedField); selects and the date range apply
 * immediately.
 */
export function OrdersToolbar({
  filters,
  facets,
  total,
  hasFilters,
  onChange,
  onReset,
}: OrdersToolbarProps) {
  // Collapsed by default on every screen size; the Filters button reveals the grid.
  const [filtersOpen, setFiltersOpen] = useState(false)
  const counts = useOrderFulfillmentCounts(filters, FULFILLMENT_VALUES)

  const [search, setSearch] = useDebouncedField(filters.search, (search) =>
    onChange({ search }),
  )
  const [minTotal, setMinTotal] = useDebouncedField(filters.minTotal, (minTotal) =>
    onChange({ minTotal }),
  )
  const [maxTotal, setMaxTotal] = useDebouncedField(filters.maxTotal, (maxTotal) =>
    onChange({ maxTotal }),
  )

  return (
    <>
      <section
        aria-label="Order filters"
        className="border-border bg-bg flex flex-col gap-4 rounded-2xl border p-4 sm:p-5"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="border-border bg-surface focus-within:border-accent focus-within:outline-accent-tint flex h-11 min-w-0 items-center gap-2.5 rounded-lg border px-3.5 transition-colors focus-within:outline-2 lg:flex-1">
            <SearchIcon className="text-text-muted shrink-0" />
            <input
              type="search"
              aria-label="Search orders"
              placeholder="Smart Search: order number, customer, email, SKU, product…"
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
              Order Date
            </span>
            <div className="min-w-0 flex-1 lg:w-52 lg:flex-none">
              <DateRangePicker
                label="Date range"
                from={filters.from}
                to={filters.to}
                onChange={(range) => onChange(range)}
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
            aria-label="Filter by fulfillment"
            className="border-border bg-surface flex max-w-full min-w-0 [scrollbar-width:none] gap-1 overflow-x-auto rounded-xl border p-1 [&::-webkit-scrollbar]:hidden"
          >
            {FULFILLMENT_TABS.map((tab) => {
              const active = filters.fulfillment === tab.value
              // The open tab can fall back to the list's own total while its count loads.
              const count = counts[tab.value] ?? (active ? total : null)
              return (
                <button
                  key={tab.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ fulfillment: tab.value })}
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

          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="order-filter-grid"
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

        <div
          id="order-filter-grid"
          inert={!filtersOpen}
          className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
            filtersOpen
              ? 'grid-rows-[1fr] opacity-100'
              : '-mt-4 grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="-m-1 overflow-hidden p-1">
            <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
              <SelectField
                id="filter-payment"
                label="Payment"
                icon={DollarSignIcon}
                value={filters.financial}
                options={PAYMENT_OPTIONS}
                onChange={(financial) =>
                  onChange({ financial: financial as OrderFinancialStatus | '' })
                }
              />
              <SelectField
                id="filter-source"
                label="Source"
                icon={OrdersIcon}
                value={filters.source}
                options={SOURCE_OPTIONS}
                onChange={(source) => onChange({ source: source as OrderSource | '' })}
              />
              <SelectField
                id="filter-gateway"
                label="Payment gateway"
                icon={DollarSignIcon}
                value={filters.gateway}
                options={withAll('All gateways', facets.gateways, filters.gateway)}
                onChange={(gateway) => onChange({ gateway })}
              />
              <SelectField
                id="filter-tag"
                label="Tag"
                icon={TagIcon}
                value={filters.tag}
                options={withAll('All Tags', facets.tags, filters.tag)}
                onChange={(tag) => onChange({ tag })}
              />
              <SelectField
                id="filter-cancelled"
                label="Cancelled"
                icon={BoxesIcon}
                value={filters.cancelled}
                options={CANCELLED_OPTIONS}
                onChange={(cancelled) =>
                  onChange({ cancelled: cancelled as OrderFilters['cancelled'] })
                }
              />
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="filter-min-total" className={FIELD_LABEL}>
                  <DollarSignIcon width={16} height={16} className="text-text-muted" />
                  Min total
                </label>
                <input
                  id="filter-min-total"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  placeholder="0.00"
                  value={minTotal}
                  onChange={(event) => setMinTotal(event.target.value)}
                  className={FIELD_INPUT}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="filter-max-total" className={FIELD_LABEL}>
                  <DollarSignIcon width={16} height={16} className="text-text-muted" />
                  Max total
                </label>
                <input
                  id="filter-max-total"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  placeholder="Any"
                  value={maxTotal}
                  onChange={(event) => setMaxTotal(event.target.value)}
                  className={FIELD_INPUT}
                />
              </div>
              <SelectField
                id="filter-sort"
                label="Sort by"
                icon={ArrowUpDownIcon}
                value={filters.sort}
                options={SORT_OPTIONS}
                onChange={(sort) => onChange({ sort: sort as OrderSort })}
              />
              <SelectField
                id="filter-order"
                label="Order"
                value={filters.order}
                options={ORDER_OPTIONS}
                onChange={(order) => onChange({ order: order as OrderFilters['order'] })}
              />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
