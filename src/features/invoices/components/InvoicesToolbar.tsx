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
  INVOICE_KINDS,
  INVOICE_PAYMENT_STATUSES,
  INVOICE_SORTS,
  type InvoiceKind,
  type InvoiceKindCount,
  type InvoicePaymentStatus,
  type InvoiceSort,
} from '../../../lib/api/invoices.ts'
import type { InvoiceFilters } from '../hooks/useInvoices.ts'
import { kindLabel, paymentLabel } from '../utils/format.ts'

const SORT_LABELS: Record<InvoiceSort, string> = {
  number: 'Invoice number',
  date: 'Date',
  due_date: 'Due date',
  total: 'Total',
  outstanding: 'Outstanding amount',
  customer: 'Customer',
}
const SORT_OPTIONS: SelectOption[] = INVOICE_SORTS.map((value) => ({
  value,
  label: SORT_LABELS[value],
}))
const ORDER_OPTIONS: SelectOption[] = [
  { value: 'desc', label: 'Descending' },
  { value: 'asc', label: 'Ascending' },
]
const PAYMENT_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Payment Statuses' },
  ...INVOICE_PAYMENT_STATUSES.map((value) => ({ value, label: paymentLabel(value) })),
]

// The filter grid is compact, as on the Orders and Products pages.
const FIELD_INPUT =
  'border-border bg-bg text-text focus:border-accent focus:outline-accent-tint h-8 w-full min-w-0 rounded-lg border px-2.5 text-[0.76rem] font-medium transition-colors outline-none focus:outline-2'
const FIELD_LABEL = 'text-text flex items-center gap-1.5 text-[0.72rem] font-semibold'

interface InvoicesToolbarProps {
  filters: InvoiceFilters
  /** The answer's `kind_counts`: how many documents of each type match. */
  kindCounts: readonly InvoiceKindCount[]
  hasFilters: boolean
  onChange: (changes: Partial<InvoiceFilters>) => void
  onReset: () => void
  /** Buttons at the end of the search row (the page's Columns menu). */
  actions?: ReactNode
}

/**
 * One card, like the Orders and Products lists: the search row — the search box, the **Invoice
 * Date** range, the Filters button and Clear All — and the collapsible grid under it: **Document
 * Type** (with the count of each from `kind_counts`), **Payment Status**, **Customer Account
 * Reference**, **Taken By**, **Min / Max Total**, **Sort by** and **Order**. Typing is instant
 * locally and sent to the API once the user pauses (see useDebouncedField); the selects and the
 * date range apply at once. Every one of them is a parameter of the request — the server filters.
 */
export function InvoicesToolbar({
  filters,
  kindCounts,
  hasFilters,
  onChange,
  onReset,
  actions,
}: InvoicesToolbarProps) {
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

  // Every document type, each with its count from `kind_counts` ("Credit Note (3)").
  const countOf = (kind: string) => kindCounts.find((entry) => entry.kind === kind)?.count
  const everything =
    kindCounts.length > 0 ? kindCounts.reduce((sum, entry) => sum + entry.count, 0) : null
  const withCount = (label: string, count: number | null | undefined) =>
    count === null || count === undefined
      ? label
      : `${label} (${count.toLocaleString('en-GB')})`
  const kindOptions: SelectOption[] = [
    { value: '', label: withCount('All Documents', everything) },
    ...INVOICE_KINDS.map((kind) => ({
      value: kind,
      label: withCount(kindLabel(kind), countOf(kind)),
    })),
  ]

  return (
    <section
      aria-label="Invoice filters"
      className="border-border bg-bg flex flex-col gap-4 rounded-2xl border p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="border-border bg-surface focus-within:border-accent focus-within:outline-accent-tint flex h-11 min-w-0 items-center gap-2.5 rounded-lg border px-3.5 transition-colors focus-within:outline-2 lg:flex-1">
          <SearchIcon className="text-text-muted shrink-0" />
          <input
            type="search"
            aria-label="Search invoices"
            placeholder="Search invoice no., sales order no., customer, account ref, customer order no…"
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
            Invoice Date
          </span>
          <div className="min-w-0">
            <DateRangePicker
              label="Invoice date range"
              from={filters.from}
              to={filters.to}
              onChange={(range) => onChange(range)}
            />
          </div>
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="invoice-filter-grid"
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
        id="invoice-filter-grid"
        inert={!filtersOpen}
        className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
          filtersOpen ? 'grid-rows-[1fr] opacity-100' : '-mt-4 grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="-m-1 overflow-hidden p-1">
          <div className="grid grid-cols-2 gap-3 min-[560px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            <SelectField
              compact
              id="filter-kind"
              label="Document type"
              icon={FileTextIcon}
              value={filters.kind}
              options={kindOptions}
              onChange={(kind) => onChange({ kind: kind as InvoiceKind | '' })}
            />
            <SelectField
              compact
              id="filter-payment-status"
              label="Payment status"
              icon={ListChecksIcon}
              value={filters.paymentStatus}
              options={PAYMENT_OPTIONS}
              onChange={(paymentStatus) =>
                onChange({ paymentStatus: paymentStatus as InvoicePaymentStatus | '' })
              }
            />
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="filter-account-ref" className={FIELD_LABEL}>
                <UsersIcon width={14} height={14} className="text-text-muted" />
                Customer account reference
              </label>
              <input
                id="filter-account-ref"
                type="text"
                autoComplete="off"
                maxLength={100}
                placeholder="Any"
                value={accountRef}
                onChange={(event) => setAccountRef(event.target.value)}
                className={FIELD_INPUT}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="filter-taken-by" className={FIELD_LABEL}>
                <UsersIcon width={14} height={14} className="text-text-muted" />
                Taken by
              </label>
              <input
                id="filter-taken-by"
                type="text"
                autoComplete="off"
                maxLength={100}
                placeholder="Anyone"
                value={takenBy}
                onChange={(event) => setTakenBy(event.target.value)}
                className={FIELD_INPUT}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="filter-min-total" className={FIELD_LABEL}>
                <PoundIcon width={14} height={14} className="text-text-muted" />
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
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="filter-max-total" className={FIELD_LABEL}>
                <PoundIcon width={14} height={14} className="text-text-muted" />
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
              compact
              id="filter-sort"
              label="Sort by"
              icon={ArrowUpDownIcon}
              value={filters.sort}
              options={SORT_OPTIONS}
              onChange={(sort) => onChange({ sort: sort as InvoiceSort })}
            />
            <SelectField
              compact
              id="filter-order"
              label="Order"
              value={filters.order}
              options={ORDER_OPTIONS}
              onChange={(order) => onChange({ order: order as InvoiceFilters['order'] })}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
