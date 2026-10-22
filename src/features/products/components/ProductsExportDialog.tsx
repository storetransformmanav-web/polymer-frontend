import { useId, useMemo, useState } from 'react'
import type { ProductFilters, ProductsFacets } from '../../../app/store/productsSlice.ts'
import { BoxesIcon, DollarSignIcon, TagIcon } from '../../../components/ui/icons.tsx'
import { ExportDialog, type ExportScope } from '../../../components/ui/ExportDialog.tsx'
import {
  ExportFilterGrid,
  ExportNumberField,
} from '../../../components/ui/ExportFilterFields.tsx'
import { withAll } from '../../../components/ui/selectOptions.ts'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import { useMatchingCount } from '../../../hooks/useMatchingCount.ts'
import { pickColumns, type ExportFormat } from '../../../lib/tableExport.ts'
import { EXPORT_COLUMNS, type ProductExportColumn } from '../utils/exportColumns.ts'
import { PRODUCTS_COUNT } from '../utils/exportSource.ts'
import { STOCK_OPTIONS } from '../utils/filterOptions.ts'

/** What the dialog asks for. */
export interface ProductsExportRequest {
  scope: ExportScope
  format: ExportFormat
  columns: ProductExportColumn[]
  /** The list's filters with the dialog's changes. */
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
  onExport: (request: ProductsExportRequest) => void
}

type DialogFilters = Pick<
  ProductFilters,
  'status' | 'productType' | 'tag' | 'stock' | 'minPrice' | 'maxPrice'
>

const STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'Any status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ARCHIVED', label: 'Archived' },
]

const pickFilters = (filters: ProductFilters): DialogFilters => ({
  status: filters.status,
  productType: filters.productType,
  tag: filters.tag,
  stock: filters.stock,
  minPrice: filters.minPrice,
  maxPrice: filters.maxPrice,
})

/** Do the dialog's filters differ from the list's own? */
function filtersDiffer(listFilters: ProductFilters, values: DialogFilters): boolean {
  const own = pickFilters(listFilters)
  return (Object.keys(own) as (keyof DialogFilters)[]).some(
    (key) => own[key] !== values[key],
  )
}

/**
 * The products export dialog: the shared export layout (format, columns, rows) with the
 * product filters — status, stock, type, tag and price — in its "Advanced
 * filters", starting from the list's own. The list's search is kept as it is.
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
  const [values, setValues] = useState<DialogFilters>(() => pickFilters(filters))
  const setFilter = (changes: Partial<DialogFilters>) =>
    setValues((current) => ({ ...current, ...changes }))

  const exportFilters = useMemo<ProductFilters>(
    () => ({ ...filters, ...values }),
    [filters, values],
  )
  // How many products match the filters (the list's own total until they are changed).
  const matching = useMatchingCount(exportFilters, filters, total, PRODUCTS_COUNT)
  const filtersChanged = filtersDiffer(filters, values)
  // The current page: the rows shown, or — with other filters — that page of the matches.
  const pageRows = filtersChanged
    ? matching === null
      ? null
      : Math.max(0, Math.min(filters.pageSize, matching - (page - 1) * filters.pageSize))
    : pageCount
  const appliedFilters = (Object.keys(values) as (keyof DialogFilters)[]).filter(
    (key) => values[key].trim() !== '',
  ).length

  return (
    <ExportDialog
      title="Export products"
      noun={{ one: 'product', many: 'products' }}
      columns={EXPORT_COLUMNS}
      pageCount={pageCount}
      page={page}
      total={total}
      pageRows={pageRows}
      matching={matching}
      filtersChanged={filtersChanged}
      appliedFilters={appliedFilters}
      filtersHint="Filter by status, type, tag, stock and price."
      onResetFilters={() => setValues(pickFilters(filters))}
      onClose={onClose}
      onExport={(choice) =>
        onExport({
          scope: choice.scope,
          format: choice.format,
          columns: pickColumns(EXPORT_COLUMNS, choice.columnIds),
          filters: exportFilters,
          filtersChanged,
        })
      }
      filters={
        <ExportFilterGrid>
          <SelectField
            id={`${base}-status`}
            label="Status"
            icon={BoxesIcon}
            value={values.status}
            options={STATUS_OPTIONS}
            onChange={(status) =>
              setFilter({ status: status as DialogFilters['status'] })
            }
          />
          <SelectField
            id={`${base}-stock`}
            label="Stock"
            icon={BoxesIcon}
            value={values.stock}
            options={STOCK_OPTIONS}
            onChange={(stock) => setFilter({ stock: stock as DialogFilters['stock'] })}
          />
          <SelectField
            id={`${base}-type`}
            label="Product type"
            icon={BoxesIcon}
            value={values.productType}
            options={withAll('All types', facets.productTypes, values.productType)}
            onChange={(productType) => setFilter({ productType })}
          />
          <SelectField
            id={`${base}-tag`}
            label="Tag"
            icon={TagIcon}
            value={values.tag}
            options={withAll('All tags', facets.tags, values.tag)}
            onChange={(tag) => setFilter({ tag })}
          />
          <ExportNumberField
            id={`${base}-min`}
            label="Min price"
            icon={DollarSignIcon}
            placeholder="0.00"
            value={values.minPrice}
            onChange={(minPrice) => setFilter({ minPrice })}
          />
          <ExportNumberField
            id={`${base}-max`}
            label="Max price"
            icon={DollarSignIcon}
            placeholder="Any"
            value={values.maxPrice}
            onChange={(maxPrice) => setFilter({ maxPrice })}
          />
        </ExportFilterGrid>
      }
    />
  )
}
