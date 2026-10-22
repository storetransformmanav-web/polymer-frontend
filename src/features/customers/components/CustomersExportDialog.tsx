import { useId, useMemo, useState } from 'react'
import type {
  CustomerFilters,
  CustomersFacets,
} from '../../../app/store/customersSlice.ts'
import { ExportDialog, type ExportScope } from '../../../components/ui/ExportDialog.tsx'
import {
  ExportFilterGrid,
  ExportNumberField,
} from '../../../components/ui/ExportFilterFields.tsx'
import {
  DollarSignIcon,
  MailIcon,
  OrdersIcon,
  SearchIcon,
  TagIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import { withAll } from '../../../components/ui/selectOptions.ts'
import { SelectField } from '../../../components/ui/SelectField.tsx'
import { useMatchingCount } from '../../../hooks/useMatchingCount.ts'
import { pickColumns, type ExportFormat } from '../../../lib/tableExport.ts'
import {
  CUSTOMER_EXPORT_COLUMNS,
  type CustomerExportColumn,
} from '../utils/exportColumns.ts'
import { CUSTOMERS_COUNT } from '../utils/exportSource.ts'
import {
  MARKETING_OPTIONS,
  ORDERS_OPTIONS,
  ROLE_OPTIONS,
  STATE_OPTIONS,
} from '../utils/filterOptions.ts'

/** What the dialog asks for. */
export interface CustomersExportRequest {
  scope: ExportScope
  format: ExportFormat
  columns: CustomerExportColumn[]
  /** The list's filters with the dialog's changes. */
  filters: CustomerFilters
  /** Are they different from the list's own (so the rows on screen are not the ones wanted)? */
  filtersChanged: boolean
}

interface CustomersExportDialogProps {
  /** Customers on the page being shown. */
  pageCount: number
  /** Its page number. */
  page: number
  /** The list's own search, filters and sort — what the dialog starts from. */
  filters: CustomerFilters
  /** How many customers match them, across every page. */
  total: number
  facets: CustomersFacets
  onClose: () => void
  onExport: (request: CustomersExportRequest) => void
}

type DialogFilters = Pick<
  CustomerFilters,
  'role' | 'state' | 'marketing' | 'orders' | 'tag' | 'country' | 'minSpent' | 'maxSpent'
>

const pickFilters = (filters: CustomerFilters): DialogFilters => ({
  role: filters.role,
  state: filters.state,
  marketing: filters.marketing,
  orders: filters.orders,
  tag: filters.tag,
  country: filters.country,
  minSpent: filters.minSpent,
  maxSpent: filters.maxSpent,
})

/** Do the dialog's filters differ from the list's own? */
function filtersDiffer(listFilters: CustomerFilters, values: DialogFilters): boolean {
  const own = pickFilters(listFilters)
  return (Object.keys(own) as (keyof DialogFilters)[]).some(
    (key) => own[key] !== values[key],
  )
}

/**
 * The customers export dialog: the shared export layout (format, columns, rows) with the
 * customer filters — role, state, marketing, orders, country, tag and spend — in
 * its "Advanced filters", starting from the list's own.
 */
export function CustomersExportDialog({
  pageCount,
  page,
  filters,
  total,
  facets,
  onClose,
  onExport,
}: CustomersExportDialogProps) {
  const base = useId()
  const [values, setValues] = useState<DialogFilters>(() => pickFilters(filters))
  const setFilter = (changes: Partial<DialogFilters>) =>
    setValues((current) => ({ ...current, ...changes }))

  const exportFilters = useMemo<CustomerFilters>(
    () => ({ ...filters, ...values }),
    [filters, values],
  )
  // How many customers match the filters (the list's own total until they are changed).
  const matching = useMatchingCount(exportFilters, filters, total, CUSTOMERS_COUNT)
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
      title="Export customers"
      noun={{ one: 'customer', many: 'customers' }}
      columns={CUSTOMER_EXPORT_COLUMNS}
      pageCount={pageCount}
      page={page}
      total={total}
      pageRows={pageRows}
      matching={matching}
      filtersChanged={filtersChanged}
      appliedFilters={appliedFilters}
      filtersHint="Filter by role, state, marketing, orders, country, tag and spend."
      onResetFilters={() => setValues(pickFilters(filters))}
      onClose={onClose}
      onExport={(choice) =>
        onExport({
          scope: choice.scope,
          format: choice.format,
          columns: pickColumns(CUSTOMER_EXPORT_COLUMNS, choice.columnIds),
          filters: exportFilters,
          filtersChanged,
        })
      }
      filters={
        <ExportFilterGrid>
          <SelectField
            id={`${base}-role`}
            label="Role"
            icon={UsersIcon}
            value={values.role}
            options={ROLE_OPTIONS}
            onChange={(role) => setFilter({ role: role as DialogFilters['role'] })}
          />
          <SelectField
            id={`${base}-state`}
            label="Account State"
            icon={UsersIcon}
            value={values.state}
            options={STATE_OPTIONS}
            onChange={(state) => setFilter({ state: state as DialogFilters['state'] })}
          />
          <SelectField
            id={`${base}-marketing`}
            label="Marketing"
            icon={MailIcon}
            value={values.marketing}
            options={MARKETING_OPTIONS}
            onChange={(marketing) =>
              setFilter({ marketing: marketing as DialogFilters['marketing'] })
            }
          />
          <SelectField
            id={`${base}-orders`}
            label="Orders"
            icon={OrdersIcon}
            value={values.orders}
            options={ORDERS_OPTIONS}
            onChange={(orders) =>
              setFilter({ orders: orders as DialogFilters['orders'] })
            }
          />
          <SelectField
            id={`${base}-country`}
            label="Country"
            icon={SearchIcon}
            value={values.country}
            options={withAll('All countries', facets.countries, values.country)}
            onChange={(country) => setFilter({ country })}
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
            label="Min spent"
            icon={DollarSignIcon}
            placeholder="0.00"
            value={values.minSpent}
            onChange={(minSpent) => setFilter({ minSpent })}
          />
          <ExportNumberField
            id={`${base}-max`}
            label="Max spent"
            icon={DollarSignIcon}
            placeholder="Any"
            value={values.maxSpent}
            onChange={(maxSpent) => setFilter({ maxSpent })}
          />
        </ExportFilterGrid>
      }
    />
  )
}
