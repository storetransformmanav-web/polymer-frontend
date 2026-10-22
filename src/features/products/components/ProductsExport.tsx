import { useState } from 'react'
import type { ProductFilters, ProductsFacets } from '../../../app/store/productsSlice.ts'
import { ExportButton, ExportStatus } from '../../../components/ui/ExportControls.tsx'
import { useTableExport } from '../../../hooks/useTableExport.ts'
import type { ProductListItem } from '../../../lib/api/endpoints.ts'
import { PRODUCTS_EXPORT } from '../utils/exportSource.ts'
import {
  ProductsExportDialog,
  type ProductsExportRequest,
} from './ProductsExportDialog.tsx'

interface ProductsExportProps {
  /** The products on the page being shown. */
  items: readonly ProductListItem[]
  /** Its page number. */
  page: number
  /** The search, filters and sort behind the list. */
  filters: ProductFilters
  /** How many products match them, across every page. */
  total: number
  facets: ProductsFacets
}

/**
 * The **Export** button of the products strip, and the progress of an export beside it.
 * The button opens `ProductsExportDialog` (format, columns, rows, filters); reading every
 * page can take a few seconds, so its progress — with Cancel — stays in the strip after
 * the dialog has closed.
 */
export function ProductsExport({
  items,
  page,
  filters,
  total,
  facets,
}: ProductsExportProps) {
  const { state, exportPage, exportFilteredPage, exportAll, cancel, dismiss } =
    useTableExport(PRODUCTS_EXPORT)
  const [open, setOpen] = useState(false)
  const running = state.status === 'running'

  function start(request: ProductsExportRequest) {
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
        <ProductsExportDialog
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
