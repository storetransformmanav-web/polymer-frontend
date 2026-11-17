import { useState } from 'react'
import { InAppBar } from '../../../components/ui/AppBarSlot.tsx'
import type { ProductFilters } from '../../../app/store/productsSlice.ts'
import { ExportButton, ExportStatus } from '../../../components/ui/ExportControls.tsx'
import type { ProductListItem } from '../../../lib/api/endpoints.ts'
import { useProductsExport } from '../hooks/useProductsExport.ts'
import { ProductsExportDialog } from './ProductsExportDialog.tsx'

interface ProductsExportProps {
  /** The products on the page being shown. */
  items: readonly ProductListItem[]
  /** The ticked products on that page. */
  selected: readonly ProductListItem[]
  /** The search and filters behind the list. */
  filters: ProductFilters
  /** How many products match them, across every page. */
  total: number
  /** Show the button (the list is on screen); the progress and the dialog stay either way. */
  visible?: boolean
}

/**
 * The **Export** button, in the top bar beside "Sync products" (`InAppBar`), and the
 * progress of an export beside it. The button opens `ProductsExportDialog`; the file is
 * built by the backend (`GET /products/export`), which can take a few seconds for a whole
 * store, so its progress — with Cancel — stays in the bar after the dialog has closed.
 */
export function ProductsExport({
  items,
  selected,
  filters,
  total,
  visible = true,
}: ProductsExportProps) {
  const { state, start, cancel, dismiss } = useProductsExport()
  const [open, setOpen] = useState(false)
  const running = state.status === 'running'

  return (
    <>
      <InAppBar>
        <div className="max-w-[16rem] min-w-0">
          <ExportStatus state={state} onCancel={cancel} onDismiss={dismiss} />
        </div>
        {visible && (
          <ExportButton
            disabled={running || (items.length === 0 && total === 0)}
            onClick={() => setOpen(true)}
          />
        )}
      </InAppBar>
      {open && (
        <ProductsExportDialog
          items={items}
          selected={selected}
          filters={filters}
          total={total}
          onClose={() => setOpen(false)}
          onExport={(request) => {
            setOpen(false)
            void start(request)
          }}
        />
      )}
    </>
  )
}
