import { useId, useMemo, useState } from 'react'
import type { ProductFilters, ProductsFacets } from '../../../app/store/productsSlice.ts'
import {
  BoxesIcon,
  CheckIcon,
  CsvFileIcon,
  DatabaseIcon,
  ExcelFileIcon,
  ChevronDownIcon,
  DollarSignIcon,
  DownloadIcon,
  RefreshIcon,
  SearchIcon,
  SlidersIcon,
  TagIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { Modal } from '../../../components/ui/Modal.tsx'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import { useMatchingCount } from '../hooks/useMatchingCount.ts'
import { ExportIllustration } from './ExportIllustration.tsx'
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  pickColumns,
  type ExportColumn,
  type ExportColumnId,
} from '../utils/exportColumns.ts'
import { EXPORT_FORMATS, type ExportFormat } from '../utils/exportFile.ts'
import { STOCK_OPTIONS, withAll } from '../utils/filterOptions.ts'

/** What the dialog asks for. */
export interface ExportRequest {
  scope: 'page' | 'all'
  format: ExportFormat
  columns: ExportColumn[]
  /** The list's filters with the dialog's changes, on the list's current page. */
  filters: ProductFilters
  /** Are they different from the list's own (so the rows on screen are not the ones wanted)? */
  filtersChanged: boolean
}

interface ProductsExportDialogProps {
  /** Products on the page being shown. */
  pageCount: number
  /** Its page number. */
  page: number
  /** The list's own search, filters and sort — what the dialog starts from. */
  filters: ProductFilters
  /** How many products match them, across every page. */
  total: number
  facets: ProductsFacets
  onClose: () => void
  onExport: (request: ExportRequest) => void
}

type Scope = ExportRequest['scope']
type DialogFilters = Pick<
  ProductFilters,
  'search' | 'status' | 'productType' | 'tag' | 'stock' | 'minPrice' | 'maxPrice'
>

const STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ARCHIVED', label: 'Archived' },
]

const FIELD_INPUT =
  'border-border bg-bg text-text focus:border-accent focus:outline-accent-tint h-10 w-full min-w-0 rounded-lg border px-3 text-[0.85rem] font-medium transition-colors outline-none focus:outline-2 disabled:opacity-60'
const SECTION_TITLE = 'text-[1.02rem] font-semibold'
const LINK_BUTTON =
  'text-accent cursor-pointer border-none bg-transparent p-0 text-[0.8rem] font-semibold hover:underline disabled:pointer-events-none disabled:opacity-50'

const number = (value: number) => value.toLocaleString('en-GB')
const plural = (count: number) => `${number(count)} product${count === 1 ? '' : 's'}`

/** Do the dialog's filters differ from the list's own? */
function filtersDiffer(listFilters: ProductFilters, values: DialogFilters): boolean {
  const own = pickFilters(listFilters)
  return (Object.keys(own) as (keyof DialogFilters)[]).some(
    (key) => own[key] !== values[key],
  )
}

const pickFilters = (filters: ProductFilters): DialogFilters => ({
  search: filters.search,
  status: filters.status,
  productType: filters.productType,
  tag: filters.tag,
  stock: filters.stock,
  minPrice: filters.minPrice,
  maxPrice: filters.maxPrice,
})

/**
 * The export dialog: pick the file format (Excel or CSV), the columns (all of them are
 * listed, with a search), which rows (this page, or every page) and — under "Advanced
 * filters" — the products to include. "You'll export N products" counts them live.
 */
export function ProductsExportDialog({
  pageCount,
  page,
  filters,
  total,
  facets,
  onClose,
  onExport,
}: ProductsExportDialogProps) {
  const base = useId()
  const [format, setFormat] = useState<ExportFormat>('xlsx')
  const [selected, setSelected] = useState<ReadonlySet<ExportColumnId>>(
    () => new Set(DEFAULT_EXPORT_COLUMNS),
  )
  const [columnSearch, setColumnSearch] = useState('')
  const [scope, setScope] = useState<Scope | null>('page')
  const [filterValues, setFilterValues] = useState<DialogFilters>(() =>
    pickFilters(filters),
  )
  const [filtersOpen, setFiltersOpen] = useState(false)

  const exportFilters = useMemo<ProductFilters>(
    () => ({ ...filters, ...filterValues, page: scope === 'all' ? 1 : page }),
    [filters, filterValues, scope, page],
  )
  // How many products match the filters (the list's own total until they are changed).
  const matching = useMatchingCount(exportFilters, filters, total, true)
  const filtersChanged = filtersDiffer(filters, filterValues)
  // The current page: the rows shown, or — with other filters — that page of the matches.
  const pageRows = filtersChanged
    ? matching === null
      ? null
      : Math.max(0, Math.min(filters.pageSize, matching - (page - 1) * filters.pageSize))
    : pageCount
  const count = scope === 'page' ? pageRows : scope === 'all' ? matching : null

  const visibleColumns = useMemo(() => {
    const query = columnSearch.trim().toLowerCase()
    return query
      ? EXPORT_COLUMNS.filter((column) => column.header.toLowerCase().includes(query))
      : EXPORT_COLUMNS
  }, [columnSearch])

  const appliedFilters = (Object.keys(filterValues) as (keyof DialogFilters)[]).filter(
    (key) => filterValues[key].trim() !== '',
  ).length
  const canExport =
    selected.size > 0 &&
    scope !== null &&
    count !== 0 &&
    !(scope === 'page' && pageRows === 0)

  const setFilter = (changes: Partial<DialogFilters>) =>
    setFilterValues((current) => ({ ...current, ...changes }))

  function toggleColumn(id: ExportColumnId) {
    setSelected((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  function reset() {
    setFormat('xlsx')
    setSelected(new Set(DEFAULT_EXPORT_COLUMNS))
    setColumnSearch('')
    setScope('page')
    setFilterValues(pickFilters(filters))
  }

  function submit() {
    if (!canExport || scope === null) return
    onExport({
      scope,
      format,
      columns: pickColumns(selected),
      filters: exportFilters,
      filtersChanged,
    })
  }

  return (
    <Modal label="Export products" onClose={onClose} wide>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Left: what this is, the file format and how much will be exported. */}
        <aside className="bg-accent-tint/40 border-border flex shrink-0 flex-col gap-5 border-b p-5 md:w-[19rem] md:overflow-y-auto md:border-r md:border-b-0 md:p-6">
          <div className="flex flex-col gap-2">
            <span className="bg-accent text-accent-contrast flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm">
              <DownloadIcon width={24} height={24} />
            </span>
            <h2 className="mt-1 text-[1.4rem] leading-tight font-semibold">
              Export products
            </h2>
            <p className="text-text-muted text-[0.88rem] leading-relaxed">
              Choose the format, columns and filters for your export. We&apos;ll prepare a
              file with your current data view.
            </p>
          </div>

          <fieldset className="flex min-w-0 flex-col gap-3 border-none p-0">
            <legend className="mb-3 flex items-center gap-2 text-[0.92rem] font-semibold">
              <SlidersIcon width={16} height={16} className="text-text-muted" />
              File format
            </legend>
            {EXPORT_FORMATS.map((option) => {
              const active = format === option.value
              const FormatIcon = option.value === 'xlsx' ? ExcelFileIcon : CsvFileIcon
              return (
                <label
                  key={option.value}
                  className={`has-[:focus-visible]:outline-accent relative flex cursor-pointer items-center gap-3.5 rounded-2xl border p-3.5 transition-colors has-[:focus-visible]:outline-2 ${
                    active
                      ? 'border-accent bg-accent-tint/60 shadow-sm'
                      : 'border-border bg-bg hover:border-accent/60'
                  }`}
                >
                  <FormatIcon
                    width={36}
                    height={36}
                    className={`shrink-0 ${active ? 'text-accent' : 'text-text-muted'}`}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[0.92rem] font-semibold">{option.label}</span>
                    <span className="text-text-muted text-[0.78rem] leading-snug">
                      {option.description}
                    </span>
                  </span>
                  <input
                    type="radio"
                    name={`${base}-format`}
                    value={option.value}
                    checked={active}
                    onChange={() => setFormat(option.value)}
                    aria-label={option.label}
                    className="peer absolute inset-0 m-0 cursor-pointer opacity-0"
                  />
                  <span
                    aria-hidden="true"
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      active
                        ? 'border-accent bg-accent text-accent-contrast'
                        : 'border-border bg-bg'
                    }`}
                  >
                    {active && <CheckIcon width={12} height={12} strokeWidth={2.6} />}
                  </span>
                </label>
              )
            })}
          </fieldset>

          <div
            role="status"
            aria-live="polite"
            className="border-border bg-bg flex items-center gap-3.5 rounded-2xl border p-4"
          >
            <span className="bg-accent-tint text-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
              <DatabaseIcon width={20} height={20} />
            </span>
            <p className="text-text-muted text-[0.8rem] leading-snug">
              You&apos;ll export
              <span className="text-text my-0.5 block text-[1.25rem] leading-tight font-bold">
                {count === null ? '…' : plural(count)}
              </span>
              {scope === 'all'
                ? 'with the selected columns and filters.'
                : 'with the selected columns.'}
            </p>
          </div>

          <div className="mt-auto hidden pt-2 md:block">
            <ExportIllustration />
          </div>
        </aside>

        {/* Right: columns, rows, advanced filters. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5 md:p-6">
            <div className="flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={reset}
                className="text-accent inline-flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[0.85rem] font-semibold hover:underline"
              >
                <RefreshIcon width={15} height={15} />
                Reset to default
              </button>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="text-text-muted hover:text-text cursor-pointer border-none bg-transparent p-1"
              >
                <XIcon width={18} height={18} />
              </button>
            </div>

            {/* 1. Columns */}
            <section aria-labelledby={`${base}-columns`} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 id={`${base}-columns`} className={SECTION_TITLE}>
                    1. Select columns
                  </h3>
                  <p className="text-text-muted text-[0.84rem]">
                    Choose which product information to include in your export.
                  </p>
                </div>
                <span className="bg-accent-tint text-accent shrink-0 rounded-lg px-2.5 py-1 text-[0.78rem] font-semibold">
                  {selected.size} selected
                </span>
              </div>

              {/* <div className="border-border bg-bg focus-within:border-accent focus-within:outline-accent-tint flex h-10 items-center gap-2.5 rounded-lg border px-3 focus-within:outline-2">
                <SearchIcon width={16} height={16} className="text-text-muted shrink-0" />
                <input
                  type="search"
                  aria-label="Search columns"
                  placeholder="Search columns…"
                  value={columnSearch}
                  onChange={(event) => setColumnSearch(event.target.value)}
                  className="text-text placeholder:text-text-muted min-w-0 flex-1 border-none bg-transparent text-[0.85rem] outline-none [&::-webkit-search-cancel-button]:hidden"
                />
              </div> */}

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  className={LINK_BUTTON}
                  onClick={() => setSelected(new Set(EXPORT_COLUMNS.map((c) => c.id)))}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className={LINK_BUTTON}
                  disabled={selected.size === 0}
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </button>
              </div>

              {visibleColumns.length === 0 ? (
                <p className="text-text-muted py-3 text-[0.85rem]">
                  No column matches “{columnSearch.trim()}”.
                </p>
              ) : (
                <ul className="grid grid-cols-1 gap-2.5 min-[560px]:grid-cols-2 lg:grid-cols-3">
                  {visibleColumns.map((column) => {
                    const checked = selected.has(column.id)
                    return (
                      <li key={column.id}>
                        <label
                          className={`flex h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3 text-[0.85rem] font-medium transition-colors ${
                            checked
                              ? 'border-accent/50 bg-accent-tint/40'
                              : 'border-border bg-bg hover:border-accent/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleColumn(column.id)}
                            className="accent-accent h-4 w-4 shrink-0 cursor-pointer"
                          />
                          <span className="min-w-0 truncate">{column.header}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {/* 2. Rows */}
            <section aria-labelledby={`${base}-rows`} className="flex flex-col gap-3">
              <div>
                <h3 id={`${base}-rows`} className={SECTION_TITLE}>
                  2. Rows to export
                </h3>
                <p className="text-text-muted text-[0.84rem]">
                  This page, or every page — of the products that match the filters below.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2.5 min-[560px]:grid-cols-2">
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    scope === 'page'
                      ? 'border-accent/50 bg-accent-tint/40'
                      : 'border-border bg-bg hover:border-accent/50'
                  } ${pageRows === 0 ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={scope === 'page'}
                    disabled={pageRows === 0}
                    onChange={(event) => setScope(event.target.checked ? 'page' : null)}
                    className="accent-accent mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
                  />
                  <span className="flex flex-col">
                    <span className="text-[0.88rem] font-semibold">Current page</span>
                    <span className="text-text-muted text-[0.78rem]">
                      {filtersChanged
                        ? `Page ${page} of the products that match`
                        : `The ${plural(pageCount)} shown here`}
                    </span>
                  </span>
                </label>
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    scope === 'all'
                      ? 'border-accent/50 bg-accent-tint/40'
                      : 'border-border bg-bg hover:border-accent/50'
                  } ${total === 0 ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={scope === 'all'}
                    disabled={total === 0}
                    onChange={(event) => setScope(event.target.checked ? 'all' : null)}
                    className="accent-accent mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
                  />
                  <span className="flex flex-col">
                    <span className="text-[0.88rem] font-semibold">Export all</span>
                    <span className="text-text-muted text-[0.78rem]">
                      Every page of the matching products
                    </span>
                  </span>
                </label>
              </div>
            </section>

            {/* Advanced filters (an accordion) */}
            <section className="border-border bg-surface/50 rounded-xl border">
              <h3 className="m-0">
                <button
                  type="button"
                  aria-expanded={filtersOpen}
                  aria-controls={`${base}-filters`}
                  onClick={() => setFiltersOpen((open) => !open)}
                  className="focus-visible:outline-accent flex w-full cursor-pointer items-center gap-3 border-none bg-transparent p-4 text-left focus-visible:outline-2 focus-visible:-outline-offset-2"
                >
                  <span className="bg-bg border-border text-text-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border">
                    <SlidersIcon width={16} height={16} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[0.9rem] font-semibold">
                      Advanced filters{' '}
                      <span className="text-text-muted font-normal">(optional)</span>
                      {appliedFilters > 0 && (
                        <span className="bg-accent-tint text-accent ml-2 rounded-md px-1.5 py-0.5 text-[0.7rem] font-bold">
                          {appliedFilters} applied
                        </span>
                      )}
                    </span>
                    <span className="text-text-muted text-[0.78rem] font-normal">
                      Filter by search, status, type, tag, stock and price.
                    </span>
                  </span>
                  <ChevronDownIcon
                    width={16}
                    height={16}
                    className={`text-text-muted shrink-0 transition-transform duration-200 ${filtersOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              </h3>
              <div
                id={`${base}-filters`}
                role="region"
                aria-label="Advanced filters"
                hidden={!filtersOpen}
                className="border-border border-t p-4"
              >
                <div className="flex min-w-0 flex-col gap-4">
                  <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2">
                    {/* <div className="flex min-w-0 flex-col gap-1.5 min-[560px]:col-span-2">
                      <label
                        htmlFor={`${base}-search`}
                        className="text-text flex items-center gap-1.5 text-[0.82rem] font-semibold"
                      >
                        <SearchIcon width={16} height={16} className="text-text-muted" />
                        Search
                      </label>
                      <input
                        id={`${base}-search`}
                        type="search"
                        maxLength={200}
                        placeholder="Title, SKU, vendor, type, tag…"
                        value={filterValues.search}
                        onChange={(event) => setFilter({ search: event.target.value })}
                        className={FIELD_INPUT}
                      />
                    </div> */}
                    <SelectField
                      id={`${base}-status`}
                      label="Status"
                      icon={BoxesIcon}
                      value={filterValues.status}
                      options={STATUS_OPTIONS}
                      onChange={(status) =>
                        setFilter({ status: status as DialogFilters['status'] })
                      }
                    />
                    <SelectField
                      id={`${base}-stock`}
                      label="Stock"
                      icon={BoxesIcon}
                      value={filterValues.stock}
                      options={STOCK_OPTIONS}
                      onChange={(stock) =>
                        setFilter({ stock: stock as DialogFilters['stock'] })
                      }
                    />
                    <SelectField
                      id={`${base}-type`}
                      label="Product type"
                      icon={BoxesIcon}
                      value={filterValues.productType}
                      options={withAll(
                        'All types',
                        facets.productTypes,
                        filterValues.productType,
                      )}
                      onChange={(productType) => setFilter({ productType })}
                    />
                    <SelectField
                      id={`${base}-tag`}
                      label="Tag"
                      icon={TagIcon}
                      value={filterValues.tag}
                      options={withAll('All tags', facets.tags, filterValues.tag)}
                      onChange={(tag) => setFilter({ tag })}
                    />
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <label
                        htmlFor={`${base}-min`}
                        className="text-text flex items-center gap-1.5 text-[0.82rem] font-semibold"
                      >
                        <DollarSignIcon
                          width={16}
                          height={16}
                          className="text-text-muted"
                        />
                        Min price
                      </label>
                      <input
                        id={`${base}-min`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        placeholder="0.00"
                        value={filterValues.minPrice}
                        onChange={(event) => setFilter({ minPrice: event.target.value })}
                        className={FIELD_INPUT}
                      />
                    </div>
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <label
                        htmlFor={`${base}-max`}
                        className="text-text flex items-center gap-1.5 text-[0.82rem] font-semibold"
                      >
                        <DollarSignIcon
                          width={16}
                          height={16}
                          className="text-text-muted"
                        />
                        Max price
                      </label>
                      <input
                        id={`${base}-max`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        placeholder="Any"
                        value={filterValues.maxPrice}
                        onChange={(event) => setFilter({ maxPrice: event.target.value })}
                        className={FIELD_INPUT}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="border-border flex flex-wrap items-center justify-end gap-3 border-t p-4 md:px-6">
            <button
              type="button"
              onClick={onClose}
              className="border-border bg-bg text-text hover:border-accent h-10 cursor-pointer rounded-lg border px-5 text-[0.88rem] font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canExport}
              onClick={submit}
              className="bg-accent text-accent-contrast hover:bg-accent-hover inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border-none px-5 text-[0.88rem] font-semibold shadow-sm transition-colors disabled:pointer-events-none disabled:opacity-50"
            >
              <DownloadIcon width={16} height={16} />
              Export
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
