import { useState } from 'react'
import type {
  CustomerFilters,
  CustomersFacets,
} from '../../../app/store/customersSlice.ts'
import { ExportButton, ExportStatus } from '../../../components/ui/ExportControls.tsx'
import { useTableExport } from '../../../hooks/useTableExport.ts'
import type { CustomerListItem } from '../../../lib/api/endpoints.ts'
import { CUSTOMERS_EXPORT } from '../utils/exportSource.ts'
import {
  CustomersExportDialog,
  type CustomersExportRequest,
} from './CustomersExportDialog.tsx'

interface CustomersExportProps {
  /** The customers on the page being shown. */
  items: readonly CustomerListItem[]
  /** Its page number. */
  page: number
  /** The search, filters and sort behind the list. */
  filters: CustomerFilters
  /** How many customers match them, across every page. */
  total: number
  facets: CustomersFacets
}

/**
 * The **Export** button of the customers page, and the progress of an export beside it.
 * The button opens `CustomersExportDialog` (format, columns, rows, filters); reading every
 * page can take a few seconds, so its progress — with Cancel — stays after the dialog has closed.
 */
export function CustomersExport({
  items,
  page,
  filters,
  total,
  facets,
}: CustomersExportProps) {
  const { state, exportPage, exportFilteredPage, exportAll, cancel, dismiss } =
    useTableExport(CUSTOMERS_EXPORT)
  const [open, setOpen] = useState(false)
  const running = state.status === 'running'

  function start(request: CustomersExportRequest) {
    setOpen(false)
    const options = { format: request.format, columns: request.columns }
    if (request.scope === 'all') void exportAll(request.filters, options)
    // The page as shown — unless the filters were changed, then that page of the matches.
    else if (request.filtersChanged) {
      void exportFilteredPage(request.filters, page, filters.pageSize, options)
    } else exportPage(items, page, options)
  }

  return (
    <>
      <ExportStatus state={state} onCancel={cancel} onDismiss={dismiss} />
      <ExportButton
        disabled={running || (items.length === 0 && total === 0)}
        onClick={() => setOpen(true)}
      />
      {open && (
        <CustomersExportDialog
          pageCount={items.length}
          page={page}
          filters={filters}
          total={total}
          facets={facets}
          onClose={() => setOpen(false)}
          onExport={start}
        />
      )}
    </>
  )
}
