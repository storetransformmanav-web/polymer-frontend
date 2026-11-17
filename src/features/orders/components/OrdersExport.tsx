import { useState } from 'react'
import type { OrderFilters } from '../../../app/store/ordersSlice.ts'
import { InAppBar } from '../../../components/ui/AppBarSlot.tsx'
import { ExportButton, ExportStatus } from '../../../components/ui/ExportControls.tsx'
import { useCsvExport } from '../../../hooks/useCsvExport.ts'
import { api, type OrderListItem } from '../../../lib/api/endpoints.ts'
import { orderExportFilename } from '../utils/exportRequest.ts'
import { OrdersExportDialog } from './OrdersExportDialog.tsx'

interface OrdersExportProps {
  /** The orders on the page being shown. */
  items: readonly OrderListItem[]
  /** The search and filters behind the list. */
  filters: OrderFilters
  /** How many orders match them, across every page. */
  total: number
  /** Show the button (the list is on screen); the progress and the dialog stay either way. */
  visible?: boolean
}

/**
 * The **Export** button of the orders page, in the top bar (`InAppBar`), and the progress of an
 * export beside it. The button opens `OrdersExportDialog`; the file is built by the backend
 * (`GET /orders/export`, a Shopify-format CSV), which can take a few seconds for a whole store,
 * so its progress — with Cancel — stays in the bar after the dialog has closed.
 */
export function OrdersExport({
  items,
  filters,
  total,
  visible = true,
}: OrdersExportProps) {
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
        <OrdersExportDialog
          items={items}
          filters={filters}
          total={total}
          onClose={() => setOpen(false)}
          onExport={(request) => {
            setOpen(false)
            void start({
              read: (signal) => api.orders.export(request.params, signal),
              filename: () => orderExportFilename(request.params.shop),
              format: request.format,
              summary: request.summary,
            })
          }}
        />
      )}
    </>
  )
}
