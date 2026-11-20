import { useState } from 'react'
import { InAppBar } from '../../../components/ui/AppBarSlot.tsx'
import { ExportButton, ExportStatus } from '../../../components/ui/ExportControls.tsx'
import { useCsvExport } from '../../../hooks/useCsvExport.ts'
import { api } from '../../../lib/api/endpoints.ts'
import type { SageStockItem } from '../../../lib/api/sageStock.ts'
import type { SageStockFilters } from '../hooks/useSageStock.ts'
import { sageStockExportFilename } from '../utils/exportRequest.ts'
import { SageStockExportDialog } from './SageStockExportDialog.tsx'

interface SageStockExportProps {
  /** The stock items on the page being shown. */
  items: readonly SageStockItem[]
  /** The search and filters behind the list. */
  filters: SageStockFilters
  /** How many items match them, across every page. */
  total: number
  /** Show the button (the list is on screen); the progress and the dialog stay either way. */
  visible?: boolean
}

/**
 * The **Export** button of the Sage stock page, in the top bar (`InAppBar`) — the same place and look as
 * the Sage customers' — and the progress of an export beside it. The button opens `SageStockExportDialog`;
 * the file is built by the backend (`GET /sage/stock/export`, a CSV), which can take a few seconds, so its
 * progress — with Cancel — stays in the bar after the dialog has closed.
 */
export function SageStockExport({
  items,
  filters,
  total,
  visible = true,
}: SageStockExportProps) {
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
        <SageStockExportDialog
          items={items}
          filters={filters}
          total={total}
          onClose={() => setOpen(false)}
          onExport={(request) => {
            setOpen(false)
            void start({
              read: (signal) => api.sageStock.export(request.params, signal),
              filename: () => sageStockExportFilename(),
              format: request.format,
              summary: request.summary,
            })
          }}
        />
      )}
    </>
  )
}
