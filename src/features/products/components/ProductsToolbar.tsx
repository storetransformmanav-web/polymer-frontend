import { useState } from 'react'
import type { ProductFilters, ProductsFacets } from '../../../app/store/productsSlice.ts'
import {
  ArrowUpDownIcon,
  BoxesIcon,
  ChevronDownIcon,
  DollarSignIcon,
  SearchIcon,
  SlidersIcon,
  TagIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import { useDebouncedField } from '../../../hooks/useDebouncedField.ts'
import { useProductStatusCounts } from '../hooks/useProductStatusCounts.ts'
import { STOCK_OPTIONS, withAll } from '../utils/filterOptions.ts'
import {
  PRODUCT_SORTS,
  type ProductSort,
  type ProductStatus,
} from '../../../lib/api/endpoints.ts'

const STATUS_TABS: { value: ProductStatus | ''; label: string }[] = [
  { value: '', label: 'All Products' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ARCHIVED', label: 'Archived' },
]
const STATUS_VALUES = STATUS_TABS.map((tab) => tab.value)

const SORT_LABELS: Record<ProductSort, string> = {
  created_at: 'Date created',
  updated_at: 'Last updated',
  title: 'Name',
  price: 'Price',
  inventory: 'Inventory',
  synced_at: 'Last synced',
}

const SORT_OPTIONS: SelectOption[] = PRODUCT_SORTS.map((value) => ({
  value,
  label: SORT_LABELS[value],
}))
const ORDER_OPTIONS: SelectOption[] = [
  { value: 'desc', label: 'Descending' },
  { value: 'asc', label: 'Ascending' },
]

const FIELD_INPUT =
  'border-border bg-bg text-text focus:border-accent focus:outline-accent-tint h-10 w-full min-w-0 rounded-lg border px-3 text-[0.85rem] font-medium transition-colors outline-none focus:outline-2'

interface ProductsToolbarProps {
  filters: ProductFilters
  facets: ProductsFacets
  total: number | null
  hasFilters: boolean
  onChange: (changes: Partial<ProductFilters>) => void
  onReset: () => void
}

/**
 * Search, status tabs and the collapsible filter grid. Typing in
 * the search/price boxes is instant locally and sent to the API once the
 * user pauses (see useDebouncedField); selects apply immediately.
 */
export function ProductsToolbar({
  filters,
  facets,
  total,
  hasFilters,
  onChange,
  onReset,
}: ProductsToolbarProps) {
  // Collapsed by default on every screen size; the Filters button reveals the grid.
  const [filtersOpen, setFiltersOpen] = useState(false)
  const counts = useProductStatusCounts(filters, STATUS_VALUES)
  const [search, setSearch] = useDebouncedField(filters.search, (search) =>
    onChange({ search }),
  )
  const [minPrice, setMinPrice] = useDebouncedField(filters.minPrice, (minPrice) =>
    onChange({ minPrice }),
  )
  const [maxPrice, setMaxPrice] = useDebouncedField(filters.maxPrice, (maxPrice) =>
    onChange({ maxPrice }),
  )

  return (
    <section
      aria-label="Product filters"
      className="border-border bg-bg flex flex-col gap-4 rounded-2xl border p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="border-border bg-surface focus-within:border-accent focus-within:outline-accent-tint flex h-11 min-w-0 items-center gap-2.5 rounded-lg border px-3.5 transition-colors focus-within:outline-2 lg:flex-1">
          <SearchIcon className="text-text-muted shrink-0" />
          <input
            type="search"
            aria-label="Search products"
            placeholder="Smart Search: title, SKU, vendor, type, tag…"
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
          aria-label="Filter by status"
          className="border-border bg-surface flex max-w-full min-w-0 [scrollbar-width:none] gap-1 overflow-x-auto rounded-xl border p-1 [&::-webkit-scrollbar]:hidden"
        >
          {STATUS_TABS.map((tab) => {
            const active = filters.status === tab.value
            // The open tab can fall back to the list's own total while its count loads.
            const count = counts[tab.value] ?? (active ? total : null)
            return (
              <button
                key={tab.value}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ status: tab.value })}
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
          aria-controls="product-filter-grid"
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
        id="product-filter-grid"
        inert={!filtersOpen}
        className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
          filtersOpen ? 'grid-rows-[1fr] opacity-100' : '-mt-4 grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="-m-1 overflow-hidden p-1">
          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
            <SelectField
              id="filter-type"
              label="Product Type"
              icon={BoxesIcon}
              value={filters.productType}
              options={withAll('All Types', facets.productTypes, filters.productType)}
              onChange={(productType) => onChange({ productType })}
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
              id="filter-stock"
              label="Stock"
              icon={BoxesIcon}
              value={filters.stock}
              options={STOCK_OPTIONS}
              onChange={(stock) => onChange({ stock: stock as ProductFilters['stock'] })}
            />
            <div className="flex min-w-0 flex-col gap-1.5">
              <label
                htmlFor="filter-min-price"
                className="text-text flex items-center gap-1.5 text-[0.82rem] font-semibold"
              >
                <DollarSignIcon width={16} height={16} className="text-text-muted" />
                Min price
              </label>
              <input
                id="filter-min-price"
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="0.00"
                value={minPrice}
                onChange={(event) => setMinPrice(event.target.value)}
                className={FIELD_INPUT}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label
                htmlFor="filter-max-price"
                className="text-text flex items-center gap-1.5 text-[0.82rem] font-semibold"
              >
                <DollarSignIcon width={16} height={16} className="text-text-muted" />
                Max price
              </label>
              <input
                id="filter-max-price"
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="Any"
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
                className={FIELD_INPUT}
              />
            </div>
            <>
              <SelectField
                id="filter-sort"
                label="Sort by"
                icon={ArrowUpDownIcon}
                value={filters.sort}
                options={SORT_OPTIONS}
                onChange={(sort) => onChange({ sort: sort as ProductSort })}
              />
              <SelectField
                id="filter-order"
                label="Order"
                value={filters.order}
                options={ORDER_OPTIONS}
                onChange={(order) =>
                  onChange({ order: order as ProductFilters['order'] })
                }
              />
            </>
          </div>
        </div>
      </div>
    </section>
  )
}
