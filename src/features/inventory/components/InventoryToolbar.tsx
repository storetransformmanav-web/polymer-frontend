import { useState, type ReactNode } from 'react'
import type { InventoryFilters } from '../../../app/store/inventorySlice.ts'
import {
  ArrowUpDownIcon,
  BoxesIcon,
  ChevronDownIcon,
  ListChecksIcon,
  MapPinIcon,
  SearchIcon,
  SlidersIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import {
  INVENTORY_SORTS,
  type InventorySort,
  type InventoryStatus,
  type InventoryTotals,
  type StockLocation,
} from '../../../lib/api/endpoints.ts'

const SORT_LABELS: Record<InventorySort, string> = {
  title: 'Product',
  sku: 'SKU',
  available: 'Available',
  on_hand: 'On hand',
  committed: 'Committed',
  incoming: 'Incoming',
  unavailable: 'Unavailable',
  updated: 'Last updated',
}
const SORT_OPTIONS: SelectOption[] = INVENTORY_SORTS.map((value) => ({
  value,
  label: SORT_LABELS[value],
}))
const ORDER_OPTIONS: SelectOption[] = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
]
const PRODUCT_STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ARCHIVED', label: 'Archived' },
]

const CHIPS: {
  value: InventoryStatus | ''
  label: string
  count: keyof InventoryTotals
}[] = [
  { value: '', label: 'All variants', count: 'variants' },
  { value: 'in_stock', label: 'In stock', count: 'in_stock' },
  { value: 'low', label: 'Low stock', count: 'low_stock' },
  { value: 'out', label: 'Out of stock', count: 'out_of_stock' },
]

const FIELD_INPUT =
  'border-border bg-bg text-text focus:border-accent focus:outline-accent-tint h-8 w-full min-w-0 rounded-lg border px-2.5 text-[0.76rem] font-medium transition-colors outline-none focus:outline-2'
const FIELD_LABEL = 'text-text flex items-center gap-1.5 text-[0.72rem] font-semibold'

interface InventoryToolbarProps {
  filters: InventoryFilters
  locations: StockLocation[]
  /** The counts on the status chips (the figures without a stock status). */
  counts: InventoryTotals | null
  hasFilters: boolean
  /** Buttons placed between Filters and Clear All (Stock history). */
  actions?: ReactNode
  onChange: (changes: Partial<InventoryFilters>) => void
  onReset: () => void
}

/**
 * Search, the Location dropdown, the Filters button, the page's actions and Clear All in one row,
 * and the collapsible filter grid under it: its first field is the **Stock status** (All variants ·
 * In stock · Low stock · Out of stock, each with its count — they stay when one is chosen), then
 * the product status, what counts as "low", sort and order. Typing is instant locally and sent once the user pauses.
 */
export function InventoryToolbar({
  filters,
  locations,
  counts,
  hasFilters,
  actions,
  onChange,
  onReset,
}: InventoryToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch] = useDebouncedField(filters.search, (search) =>
    onChange({ search }),
  )
  const [low, setLow] = useDebouncedField(filters.lowThreshold, (lowThreshold) =>
    onChange({ lowThreshold }),
  )
  // The stock status choices, each with its count ("In stock (1,266)"); the counts are the
  // latest figures that had no stock status on them, so they stay when one is chosen.
  const statusOptions: SelectOption[] = CHIPS.map((chip) => {
    const count = counts?.[chip.count]
    return {
      value: chip.value,
      label:
        count === null || count === undefined
          ? chip.label
          : `${chip.label} (${count.toLocaleString('en-GB')})`,
    }
  })
  const locationOptions: SelectOption[] = [
    { value: '', label: 'All locations' },
    ...locations.map((location) => ({
      value: String(location.id),
      label: `${location.name ?? `Location ${location.id}`} (${location.variants.toLocaleString('en-GB')})`,
    })),
  ]

  return (
    <section
      aria-label="Inventory filters"
      className="border-border bg-bg flex flex-col gap-4 rounded-2xl border p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="border-border bg-surface focus-within:border-accent focus-within:outline-accent-tint flex h-11 min-w-0 items-center gap-2.5 rounded-lg border px-3.5 transition-colors focus-within:outline-2 lg:flex-1">
          <SearchIcon className="text-text-muted shrink-0" />
          <input
            type="search"
            aria-label="Search inventory"
            placeholder="Search by product, variant, SKU or barcode"
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
          <div className="w-60 max-w-full">
            <SelectField
              id="filter-location"
              label="Location"
              hideLabel
              icon={MapPinIcon}
              value={filters.location}
              options={locationOptions}
              onChange={(location) => onChange({ location })}
            />
          </div>
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="inventory-filter-grid"
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
        id="inventory-filter-grid"
        inert={!filtersOpen}
        className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
          filtersOpen ? 'grid-rows-[1fr] opacity-100' : '-mt-4 grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="-m-1 overflow-hidden p-1">
          <div className="grid grid-cols-2 gap-3 min-[560px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            <SelectField
              compact
              id="filter-stock-status"
              label="Stock status"
              icon={BoxesIcon}
              value={filters.status}
              options={statusOptions}
              onChange={(status) =>
                onChange({ status: status as InventoryFilters['status'] })
              }
            />
            <SelectField
              compact
              id="filter-product-status"
              label="Product status"
              icon={ListChecksIcon}
              value={filters.productStatus}
              options={PRODUCT_STATUS_OPTIONS}
              onChange={(productStatus) =>
                onChange({
                  productStatus: productStatus as InventoryFilters['productStatus'],
                })
              }
            />
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="filter-low" className={FIELD_LABEL}>
                Low stock below
              </label>
              <input
                id="filter-low"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="10"
                value={low}
                onChange={(event) => setLow(event.target.value)}
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
              onChange={(sort) => onChange({ sort: sort as InventorySort })}
            />
            <SelectField
              compact
              id="filter-order"
              label="Order"
              value={filters.order}
              options={ORDER_OPTIONS}
              onChange={(order) =>
                onChange({ order: order as InventoryFilters['order'] })
              }
            />
          </div>
        </div>
      </div>
    </section>
  )
}
