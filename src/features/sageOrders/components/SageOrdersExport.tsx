import { useState } from 'react'
import { InAppBar } from '../../../components/ui/AppBarSlot.tsx'
import { ExportButton, ExportStatus } from '../../../components/ui/ExportControls.tsx'
import { useCsvExport } from '../../../hooks/useCsvExport.ts'
import { api } from '../../../lib/api/endpoints.ts'
import type { SageOrder } from '../../../lib/api/sageOrders.ts'
import type { SageOrderFilters } from '../hooks/useSageOrders.ts'
import { sageOrderExportFilename } from '../utils/exportRequest.ts'
import { SageOrdersExportDialog } from './SageOrdersExportDialog.tsx'

interface SageOrdersExportProps {
  /** The orders on the page being shown. */
  items: readonly SageOrder[]
  /** The search and filters behind the list. */
  filters: SageOrderFilters
  /** How many orders match them, across every page. */
  total: number
  /** Show the button (the list is on screen); the progress and the dialog stay either way. */
  visible?: boolean
}

/**
 * The **Export** button of the Sage orders page, in the top bar (`InAppBar`), and the progress of an
 * export beside it. The button opens `SageOrdersExportDialog`; the file is built by the backend
 * (`GET /sage/orders/export`, a CSV), which can take a few seconds, so its progress — with Cancel —
 * stays in the bar after the dialog has closed.
 */
export function SageOrdersExport({
  items,
  filters,
  total,
  visible = true,
}: SageOrdersExportProps) {
  const { state, start, cancel, dismiss } = useCsvExport()
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
        <SageOrdersExportDialog
          items={items}
          filters={filters}
          total={total}
          onClose={() => setOpen(false)}
          onExport={(request) => {
            setOpen(false)
            void start({
              read: (signal) => api.sageOrders.export(request.params, signal),
              filename: () => sageOrderExportFilename(),
              format: request.format,
              summary: request.summary,
            })
          }}
        />
      )}
    </>
  )
}
