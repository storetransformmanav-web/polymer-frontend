import { useState } from 'react'
import type { ProductFilters, ProductsFacets } from '../../../app/store/productsSlice.ts'
import {
  CheckCircleIcon,
  DownloadIcon,
  SpinnerIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import type { ProductListItem } from '../../../lib/api/endpoints.ts'
import { useExportProducts } from '../hooks/useExportProducts.ts'
import { ProductsExportDialog, type ExportRequest } from './ProductsExportDialog.tsx'

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

const number = (value: number) => value.toLocaleString('en-GB')

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
    useExportProducts()
  const [open, setOpen] = useState(false)
  const running = state.status === 'running'

  function start(request: ExportRequest) {
    setOpen(false)
    const options = { format: request.format, columns: request.columns }
    if (request.scope === 'all') void exportAll(request.filters, options)
    // The page as shown — unless the filters were changed, then that page of the matches.
    else if (request.filtersChanged) void exportFilteredPage(request.filters, options)
    else exportPage(items, page, options)
  }

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className="flex min-w-0 items-center gap-2 text-[0.82rem]"
      >
        {running && (
          <>
            <SpinnerIcon width={14} height={14} className="text-accent animate-spin" />
            <span className="text-text-muted">
              Exporting…{' '}
              {state.total > 0 && `${number(state.done)} of ${number(state.total)}`}
            </span>
            <button
              type="button"
              onClick={cancel}
              className="text-accent cursor-pointer border-none bg-transparent p-0 font-semibold hover:underline"
            >
              Cancel
            </button>
          </>
        )}
        {state.status === 'done' && (
          <>
            <CheckCircleIcon width={14} height={14} className="text-accent shrink-0" />
            <span className="text-text-muted truncate">{state.message}</span>
          </>
        )}
        {state.status === 'error' && (
          <>
            <span className="text-danger">{state.message}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={dismiss}
              className="text-text-muted hover:text-text cursor-pointer border-none bg-transparent p-0"
            >
              <XIcon width={14} height={14} />
            </button>
          </>
        )}
      </div>

      <button
        type="button"
        aria-haspopup="dialog"
        disabled={running || (items.length === 0 && total === 0)}
        onClick={() => setOpen(true)}
        className="border-border bg-bg text-text hover:border-accent hover:text-accent hover:bg-accent-tint inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50"
      >
        <DownloadIcon width={16} height={16} />
        Export
      </button>

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
