import { useState } from 'react'
import type { CustomerFilters } from '../../../app/store/customersSlice.ts'
import { InAppBar } from '../../../components/ui/AppBarSlot.tsx'
import { ExportButton, ExportStatus } from '../../../components/ui/ExportControls.tsx'
import { useCsvExport } from '../../../hooks/useCsvExport.ts'
import { api, type CustomerListItem } from '../../../lib/api/endpoints.ts'
import { customerExportFilename } from '../utils/exportRequest.ts'
import { CustomersExportDialog } from './CustomersExportDialog.tsx'

interface CustomersExportProps {
  /** The customers on the page being shown. */
  items: readonly CustomerListItem[]
  /** The search and filters behind the list. */
  filters: CustomerFilters
  /** How many customers match them, across every page. */
  total: number
  /** Show the button (the list is on screen); the progress and the dialog stay either way. */
  visible?: boolean
}

/**
 * The **Export** button of the customers page, in the top bar (`InAppBar`), and the progress
 * of an export beside it. The button opens `CustomersExportDialog`; the file is built by the
 * backend (`GET /customer/export`), which can take a few seconds for a whole store, so its
 * progress — with Cancel — stays in the bar after the dialog has closed.
 */
export function CustomersExport({
  items,
  filters,
  total,
  visible = true,
}: CustomersExportProps) {
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
        <CustomersExportDialog
          items={items}
          filters={filters}
          total={total}
          onClose={() => setOpen(false)}
          onExport={(request) => {
            setOpen(false)
            void start({
              read: (signal) => api.customers.export(request.params, signal),
              filename: () => customerExportFilename(request.params.shop),
              format: request.format,
              summary: request.summary,
            })
          }}
        />
      )}
    </>
  )
}
