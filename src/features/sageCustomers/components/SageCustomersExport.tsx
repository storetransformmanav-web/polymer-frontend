import { useState } from 'react'
import { InAppBar } from '../../../components/ui/AppBarSlot.tsx'
import { ExportButton, ExportStatus } from '../../../components/ui/ExportControls.tsx'
import { useCsvExport } from '../../../hooks/useCsvExport.ts'
import { api } from '../../../lib/api/endpoints.ts'
import type { SageCustomer } from '../../../lib/api/sageCustomers.ts'
import type { SageCustomerFilters } from '../hooks/useSageCustomers.ts'
import { sageCustomerExportFilename } from '../utils/exportRequest.ts'
import { SageCustomersExportDialog } from './SageCustomersExportDialog.tsx'

interface SageCustomersExportProps {
  /** The customers on the page being shown. */
  items: readonly SageCustomer[]
  /** The search and filters behind the list. */
  filters: SageCustomerFilters
  /** How many customers match them, across every page. */
  total: number
  /** Show the button (the list is on screen); the progress and the dialog stay either way. */
  visible?: boolean
}

/**
 * The **Export** button of the Sage customers page, in the top bar (`InAppBar`), and the progress of
 * an export beside it. The button opens `SageCustomersExportDialog`; the file is built by the backend
 * (`GET /sage/customers/export`, a CSV), which can take a few seconds, so its progress — with Cancel —
 * stays in the bar after the dialog has closed.
 */
export function SageCustomersExport({
  items,
  filters,
  total,
  visible = true,
}: SageCustomersExportProps) {
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
        <SageCustomersExportDialog
          items={items}
          filters={filters}
          total={total}
          onClose={() => setOpen(false)}
          onExport={(request) => {
            setOpen(false)
            void start({
              read: (signal) => api.sageCustomers.export(request.params, signal),
              filename: () => sageCustomerExportFilename(),
              format: request.format,
              summary: request.summary,
            })
          }}
        />
      )}
    </>
  )
}
