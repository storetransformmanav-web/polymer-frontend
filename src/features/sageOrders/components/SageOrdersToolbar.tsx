import { useState, type ReactNode } from 'react'
import { DateRangePicker } from '../../../components/ui/DateRangePicker.tsx'
import {
  ArrowUpDownIcon,
  CalendarIcon,
  ChevronDownIcon,
  FileTextIcon,
  ListChecksIcon,
  PoundIcon,
  SearchIcon,
  SlidersIcon,
  UsersIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import {
  SAGE_ORDER_SORTS,
  SAGE_ORDER_STATUSES,
  type SageOrderSort,
  type SageOrderStatus,
} from '../../../lib/api/sageOrders.ts'
import type { SageOrderFilters } from '../hooks/useSageOrders.ts'
import { humanize } from '../utils/format.ts'

const STATUS_LABELS: Record<SageOrderStatus, string> = {
  all: 'All Orders',
  open: 'Open',
  part_allocated: 'Part Allocated',
  allocated: 'Allocated',
  part_despatched: 'Part Despatched',
  complete: 'Complete',
  cancelled: 'Cancelled',
  outstanding: 'Outstanding',
}

const SORT_LABELS: Record<SageOrderSort, string> = {
  number: 'Order number',
  date: 'Order date',
  despatch_date: 'Despatch date',
  total: 'Total',
  customer: 'Customer',
}
const SORT_OPTIONS: SelectOption[] = SAGE_ORDER_SORTS.map((value) => ({
  value,
  label: SORT_LABELS[value],
}))
const ORDER_OPTIONS: SelectOption[] = [
  { value: 'desc', label: 'Descending' },
  { value: 'asc', label: 'Ascending' },
]
const INVOICED_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any Order' },
  { value: 'true', label: 'Invoiced' },
  { value: 'false', label: 'Not invoiced yet' },
]

// The filter grid is compact, as on the Orders, Products, Invoices and Sage customers pages.
const FIELD_INPUT =
  'border-border bg-bg text-text focus:border-accent focus:outline-accent-tint h-8 w-full min-w-0 rounded-lg border px-2.5 text-[0.76rem] font-medium transition-colors outline-none focus:outline-2'
const FIELD_LABEL = 'text-text flex items-center gap-1.5 text-[0.72rem] font-semibold'

interface SageOrdersToolbarProps {
  filters: SageOrderFilters
  /** The answer's `status_counts`: how many orders each status holds. */
  statusCounts: Readonly<Record<string, number>>
  hasFilters: boolean
  onChange: (changes: Partial<SageOrderFilters>) => void
  onReset: () => void
  /** Buttons at the end of the search row (the page's Columns menu). */
  actions?: ReactNode
}

/**
 * One card, like the Invoices and Sage customers lists: the search row — the search box, the **Order
 * Date** range, the Filters button and Clear All — and the collapsible grid under it: **Order status**
 * (with its count from `status_counts`), **Invoiced**, **Customer account reference**, **Taken by**,
 * **Min / Max total**, **Sort by** and **Order**. Typing is instant locally and sent to the API once the
 * user pauses (see useDebouncedField); the selects and the date range apply at once. Every one of them
 * is a parameter of the request — the server filters.
 */
export function SageOrdersToolbar({
  filters,
  statusCounts,
  hasFilters,
  onChange,
  onReset,
  actions,
}: SageOrdersToolbarProps) {
  // Collapsed by default on every screen size; the Filters button reveals the grid.
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useDebouncedField(filters.search, (search) =>
    onChange({ search }),
  )
  const [accountRef, setAccountRef] = useDebouncedField(
    filters.accountRef,
    (accountRef) => onChange({ accountRef }),
  )
  const [takenBy, setTakenBy] = useDebouncedField(filters.takenBy, (takenBy) =>
    onChange({ takenBy }),
  )
  const [minTotal, setMinTotal] = useDebouncedField(filters.minTotal, (minTotal) =>
    onChange({ minTotal }),
  )
  const [maxTotal, setMaxTotal] = useDebouncedField(filters.maxTotal, (maxTotal) =>
    onChange({ maxTotal }),
  )

  // Every status, each with its count from `status_counts` ("Open (26)"); `outstanding` has none.
  const statusOptions: SelectOption[] = SAGE_ORDER_STATUSES.map((status) => {
    const total = statusCounts[status]
    const label = STATUS_LABELS[status] ?? humanize(status)
    return {
      value: status,
      label: total === undefined ? label : `${label} (${total.toLocaleString('en-GB')})`,
    }
  })

  return (
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
            placeholder="Search order no., invoice no., customer, account ref, customer order no., PO, delivery name, contact…"
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
          <span className="text-text flex items-center gap-1.5 text-[0.82rem] font-semibold whitespace-nowrap">
            <CalendarIcon width={16} height={16} className="text-text-muted" />
            Order Date
          </span>
          <div className="min-w-0">
            <DateRangePicker
              label="Order date range"
              from={filters.from}
              to={filters.to}
              onChange={(range) => onChange({ from: range.from, to: range.to })}
            />
          </div>
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="sage-order-filter-grid"
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
        id="sage-order-filter-grid"
        inert={!filtersOpen}
        className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
          filtersOpen ? 'grid-rows-[1fr] opacity-100' : '-mt-4 grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="-m-1 overflow-hidden p-1">
          <div className="grid grid-cols-2 gap-3 min-[560px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            <SelectField
              compact
              id="filter-sage-order-status"
              label="Order status"
              icon={ListChecksIcon}
              value={filters.status}
              options={statusOptions}
              onChange={(status) => onChange({ status: status as SageOrderStatus })}
            />
            <SelectField
              compact
              id="filter-sage-order-invoiced"
              label="Invoiced"
              icon={FileTextIcon}
              value={filters.invoiced}
              options={INVOICED_OPTIONS}
              onChange={(invoiced) =>
                onChange({ invoiced: invoiced as SageOrderFilters['invoiced'] })
              }
            />
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="filter-sage-order-account" className={FIELD_LABEL}>
                <UsersIcon width={14} height={14} className="text-text-muted" />
                Customer account reference
              </label>
              <input
                id="filter-sage-order-account"
                type="text"
                autoComplete="off"
                maxLength={20}
                placeholder="Any"
                value={accountRef}
                onChange={(event) => setAccountRef(event.target.value)}
                className={FIELD_INPUT}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="filter-sage-order-taken-by" className={FIELD_LABEL}>
                <UsersIcon width={14} height={14} className="text-text-muted" />
                Taken by
              </label>
              <input
                id="filter-sage-order-taken-by"
                type="text"
                autoComplete="off"
                maxLength={60}
                placeholder="Anyone"
                value={takenBy}
                onChange={(event) => setTakenBy(event.target.value)}
                className={FIELD_INPUT}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="filter-sage-order-min-total" className={FIELD_LABEL}>
                <PoundIcon width={14} height={14} className="text-text-muted" />
                Min total
              </label>
              <input
                id="filter-sage-order-min-total"
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="0.00"
                value={minTotal}
                onChange={(event) => setMinTotal(event.target.value)}
                className={FIELD_INPUT}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="filter-sage-order-max-total" className={FIELD_LABEL}>
                <PoundIcon width={14} height={14} className="text-text-muted" />
                Max total
              </label>
              <input
                id="filter-sage-order-max-total"
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
              compact
              id="filter-sage-order-sort"
              label="Sort by"
              icon={ArrowUpDownIcon}
              value={filters.sort}
              options={SORT_OPTIONS}
              onChange={(sort) => onChange({ sort: sort as SageOrderSort })}
            />
            <SelectField
              compact
              id="filter-sage-order-order"
              label="Order"
              value={filters.order}
              options={ORDER_OPTIONS}
              onChange={(order) =>
                onChange({ order: order as SageOrderFilters['order'] })
              }
            />
          </div>
        </div>
      </div>
    </section>
  )
}
