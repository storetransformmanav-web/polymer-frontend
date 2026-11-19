import { useState, type ReactNode } from 'react'
import { DateRangePicker } from '../../../components/ui/DateRangePicker.tsx'
import {
  ArrowUpDownIcon,
  CalendarIcon,
  ChevronDownIcon,
  SearchIcon,
  SlidersIcon,
  UsersIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import {
  SAGE_CUSTOMER_SORTS,
  SAGE_CUSTOMER_TABS,
  type SageCustomerSort,
  type SageCustomerTab,
} from '../../../lib/api/sageCustomers.ts'
import type { SageCustomerFilters } from '../hooks/useSageCustomers.ts'

const TAB_LABELS: Record<SageCustomerTab, string> = {
  all: 'All Customers',
  open: 'Open',
  on_hold: 'On Hold',
  with_balance: 'With Balance',
  over_limit: 'Over Credit Limit',
  inactive: 'Inactive',
}

const SORT_LABELS: Record<SageCustomerSort, string> = {
  account_ref: 'Account reference',
  name: 'Name',
  balance: 'Balance',
  credit_limit: 'Credit limit',
  aged_over_30: 'Aged over 30 days',
  turnover_ytd: 'Turnover YTD',
  last_invoice_date: 'Last invoice date',
  last_payment_date: 'Last payment date',
  opened_on: 'Date opened',
}
const SORT_OPTIONS: SelectOption[] = SAGE_CUSTOMER_SORTS.map((value) => ({
  value,
  label: SORT_LABELS[value],
}))
const ORDER_OPTIONS: SelectOption[] = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
]
const LINKED_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any Customer' },
  { value: 'true', label: 'Also a CRM customer' },
  { value: 'false', label: 'Sage only' },
]

interface SageCustomersToolbarProps {
  filters: SageCustomerFilters
  /** The answer's `tab_counts`: how many accounts each tab holds. */
  tabCounts: Readonly<Record<string, number>>
  hasFilters: boolean
  onChange: (changes: Partial<SageCustomerFilters>) => void
  onReset: () => void
  /** Buttons at the end of the search row (the page's Columns menu). */
  actions?: ReactNode
}

/**
 * One card, like the Invoices, Orders and Products lists: the search row — the search box, the **Last
 * Invoice** date range, the Filters button and Clear All — and the collapsible grid under it: **Customer
 * list** (the tab, with its count from `tab_counts`), **CRM link**, **Sort by** and **Order**. Typing is
 * instant locally and sent to the API once the user pauses (see useDebouncedField); the selects and the
 * date range apply at once. Every one of them is a parameter of the request — the server filters.
 */
export function SageCustomersToolbar({
  filters,
  tabCounts,
  hasFilters,
  onChange,
  onReset,
  actions,
}: SageCustomersToolbarProps) {
  // Collapsed by default on every screen size; the Filters button reveals the grid.
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useDebouncedField(filters.search, (search) =>
    onChange({ search }),
  )
  // Every tab, each with its count from `tab_counts` ("On Hold (26)").
  const tabOptions: SelectOption[] = SAGE_CUSTOMER_TABS.map((tab) => {
    const total = tabCounts[tab]
    return {
      value: tab,
      label:
        total === undefined
          ? TAB_LABELS[tab]
          : `${TAB_LABELS[tab]} (${total.toLocaleString('en-GB')})`,
    }
  })

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
            placeholder="Search account ref, name, contact, email, phone, street, town, postcode, VAT number…"
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
            Last Invoice
          </span>
          <div className="min-w-0">
            <DateRangePicker
              label="Last invoice date range"
              from={filters.invoicedFrom}
              to={filters.invoicedTo}
              onChange={(range) =>
                onChange({ invoicedFrom: range.from, invoicedTo: range.to })
              }
            />
          </div>
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="sage-customer-filter-grid"
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
        id="sage-customer-filter-grid"
        inert={!filtersOpen}
        className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
          filtersOpen ? 'grid-rows-[1fr] opacity-100' : '-mt-4 grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="-m-1 overflow-hidden p-1">
          <div className="grid grid-cols-2 gap-3 min-[560px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            <SelectField
              compact
              id="filter-sage-tab"
              label="Customer list"
              icon={UsersIcon}
              value={filters.tab}
              options={tabOptions}
              onChange={(tab) => onChange({ tab: tab as SageCustomerTab })}
            />
            <SelectField
              compact
              id="filter-sage-linked"
              label="CRM link"
              icon={UsersIcon}
              value={filters.linked}
              options={LINKED_OPTIONS}
              onChange={(linked) =>
                onChange({ linked: linked as SageCustomerFilters['linked'] })
              }
            />
            <SelectField
              compact
              id="filter-sage-sort"
              label="Sort by"
              icon={ArrowUpDownIcon}
              value={filters.sort}
              options={SORT_OPTIONS}
              onChange={(sort) => onChange({ sort: sort as SageCustomerSort })}
            />
            <SelectField
              compact
              id="filter-sage-order"
              label="Order"
              value={filters.order}
              options={ORDER_OPTIONS}
              onChange={(order) =>
                onChange({ order: order as SageCustomerFilters['order'] })
              }
            />
          </div>
        </div>
      </div>
    </section>
  )
}
