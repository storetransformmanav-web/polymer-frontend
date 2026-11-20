import { useState, type ReactNode } from 'react'
import { DateRangePicker } from '../../../components/ui/DateRangePicker.tsx'
import {
  ArrowUpDownIcon,
  CalendarIcon,
  ChevronDownIcon,
  GlobeIcon,
  LinkIcon,
  ListChecksIcon,
  PoundIcon,
  SearchIcon,
  SlidersIcon,
  TagIcon,
  TruckIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import {
  SAGE_STOCK_SORTS,
  SAGE_STOCK_TABS,
  type SageStockSort,
  type SageStockTab,
} from '../../../lib/api/sageStock.ts'
import type { SageStockFilters } from '../hooks/useSageStock.ts'
import { humanize } from '../utils/format.ts'

const TAB_LABELS: Record<SageStockTab, string> = {
  all: 'All Items',
  in_stock: 'In Stock',
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',
  not_tracked: 'Not Tracked',
  inactive: 'Inactive',
}

const SORT_LABELS: Record<SageStockSort, string> = {
  stock_code: 'Stock code',
  description: 'Description',
  category: 'Category',
  qty_in_stock: 'Quantity in stock',
  qty_free: 'Free quantity',
  sales_price: 'Sales price',
  stock_value: 'Stock value',
  sales_ytd: 'Sales YTD',
  qty_sold_ytd: 'Quantity sold YTD',
  last_sale_date: 'Last sale date',
  margin_percent: 'Margin',
}
const SORT_OPTIONS: SelectOption[] = SAGE_STOCK_SORTS.map((value) => ({
  value,
  label: SORT_LABELS[value],
}))
const ORDER_OPTIONS: SelectOption[] = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
]
const WEB_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any' },
  { value: 'true', label: 'Published' },
  { value: 'false', label: 'Not published' },
]
const LINKED_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any' },
  { value: 'true', label: 'Linked to a CRM product' },
  { value: 'false', label: 'Sage only' },
]

// The filter grid is compact, as on the Orders, Products, Invoices and Sage pages.
const FIELD_INPUT =
  'border-border bg-bg text-text focus:border-accent focus:outline-accent-tint h-8 w-full min-w-0 rounded-lg border px-2.5 text-[0.76rem] font-medium transition-colors outline-none focus:outline-2'
const FIELD_LABEL = 'text-text flex items-center gap-1.5 text-[0.72rem] font-semibold'

interface SageStockToolbarProps {
  filters: SageStockFilters
  /** The answer's `tab_counts`: how many items each stock status holds. */
  tabCounts: Readonly<Record<string, number>>
  hasFilters: boolean
  onChange: (changes: Partial<SageStockFilters>) => void
  onReset: () => void
  /** Buttons at the end of the search row (the page's Columns menu). */
  actions?: ReactNode
}

/**
 * One card, like the Products, Orders and Sage lists: the search row — the search box, the **Last Sold**
 * date (items last sold on or after it), the Filters button and Clear All — and the collapsible grid under
 * it: **Stock status** (with its count from `tab_counts`), **Category**, **Supplier account**, **Web
 * published**, **CRM link**, **Min / Max price**, **Sort by** and **Order**. Typing is instant locally and
 * sent to the API once the user pauses (see useDebouncedField); the selects and the date apply at once.
 * Every one of them is a parameter of the request — the server filters.
 */
export function SageStockToolbar({
  filters,
  tabCounts,
  hasFilters,
  onChange,
  onReset,
  actions,
}: SageStockToolbarProps) {
  // Collapsed by default on every screen size; the Filters button reveals the grid.
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useDebouncedField(filters.search, (search) =>
    onChange({ search }),
  )
  const [category, setCategory] = useDebouncedField(filters.category, (category) =>
    onChange({ category }),
  )
  const [supplierRef, setSupplierRef] = useDebouncedField(
    filters.supplierRef,
    (supplierRef) => onChange({ supplierRef }),
  )
  const [minPrice, setMinPrice] = useDebouncedField(filters.minPrice, (minPrice) =>
    onChange({ minPrice }),
  )
  const [maxPrice, setMaxPrice] = useDebouncedField(filters.maxPrice, (maxPrice) =>
    onChange({ maxPrice }),
  )

  // Every status, each with its count from `tab_counts` ("Low Stock (112)").
  const tabOptions: SelectOption[] = SAGE_STOCK_TABS.map((tab) => {
    const total = tabCounts[tab]
    const label = TAB_LABELS[tab] ?? humanize(tab)
    return {
      value: tab,
      label: total === undefined ? label : `${label} (${total.toLocaleString('en-GB')})`,
    }
  })

  return (
    <section
      aria-label="Stock filters"
      className="border-border bg-bg flex flex-col gap-4 rounded-2xl border p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="border-border bg-surface focus-within:border-accent focus-within:outline-accent-tint flex h-11 min-w-0 items-center gap-2.5 rounded-lg border px-3.5 transition-colors focus-within:outline-2 lg:flex-1">
          <SearchIcon className="text-text-muted shrink-0" />
          <input
            type="search"
            aria-label="Search stock"
            placeholder="Search stock code, description, barcode, supplier part no., supplier account, category, web description…"
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
            Last Sold
          </span>
          <div className="min-w-0">
            {/* The API takes one day (`sold_since`: last sold on or after it), so only the start of
                the range is used — "Last 30 Days" is that day 30 days ago. */}
            <DateRangePicker
              label="Last sold since"
              from={filters.soldSince}
              to=""
              onChange={(range) => onChange({ soldSince: range.from })}
            />
          </div>
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="sage-stock-filter-grid"
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
        id="sage-stock-filter-grid"
        inert={!filtersOpen}
        className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
          filtersOpen ? 'grid-rows-[1fr] opacity-100' : '-mt-4 grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="-m-1 overflow-hidden p-1">
          <div className="grid grid-cols-2 gap-3 min-[560px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            <SelectField
              compact
              id="filter-sage-stock-tab"
              label="Stock status"
              icon={ListChecksIcon}
              value={filters.tab}
              options={tabOptions}
              onChange={(tab) => onChange({ tab: tab as SageStockTab })}
            />
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="filter-sage-stock-category" className={FIELD_LABEL}>
                <TagIcon width={14} height={14} className="text-text-muted" />
                Category
              </label>
              <input
                id="filter-sage-stock-category"
                type="text"
                autoComplete="off"
                maxLength={100}
                placeholder="Any"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className={FIELD_INPUT}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="filter-sage-stock-supplier" className={FIELD_LABEL}>
                <TruckIcon width={14} height={14} className="text-text-muted" />
                Supplier account
              </label>
              <input
                id="filter-sage-stock-supplier"
                type="text"
                autoComplete="off"
                maxLength={20}
                placeholder="Any"
                value={supplierRef}
                onChange={(event) => setSupplierRef(event.target.value)}
                className={FIELD_INPUT}
              />
            </div>
            <SelectField
              compact
              id="filter-sage-stock-web"
              label="Web published"
              icon={GlobeIcon}
              value={filters.webPublished}
              options={WEB_OPTIONS}
              onChange={(webPublished) =>
                onChange({
                  webPublished: webPublished as SageStockFilters['webPublished'],
                })
              }
            />
            <SelectField
              compact
              id="filter-sage-stock-linked"
              label="CRM link"
              icon={LinkIcon}
              value={filters.linked}
              options={LINKED_OPTIONS}
              onChange={(linked) =>
                onChange({ linked: linked as SageStockFilters['linked'] })
              }
            />
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="filter-sage-stock-min-price" className={FIELD_LABEL}>
                <PoundIcon width={14} height={14} className="text-text-muted" />
                Min price
              </label>
              <input
                id="filter-sage-stock-min-price"
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="0.00"
                value={minPrice}
                onChange={(event) => setMinPrice(event.target.value)}
                className={FIELD_INPUT}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="filter-sage-stock-max-price" className={FIELD_LABEL}>
                <PoundIcon width={14} height={14} className="text-text-muted" />
                Max price
              </label>
              <input
                id="filter-sage-stock-max-price"
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="Any"
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
                className={FIELD_INPUT}
              />
            </div>
            <SelectField
              compact
              id="filter-sage-stock-sort"
              label="Sort by"
              icon={ArrowUpDownIcon}
              value={filters.sort}
              options={SORT_OPTIONS}
              onChange={(sort) => onChange({ sort: sort as SageStockSort })}
            />
            <SelectField
              compact
              id="filter-sage-stock-order"
              label="Order"
              value={filters.order}
              options={ORDER_OPTIONS}
              onChange={(order) =>
                onChange({ order: order as SageStockFilters['order'] })
              }
            />
          </div>
        </div>
      </div>
    </section>
  )
}
