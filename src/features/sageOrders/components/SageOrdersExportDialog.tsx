import { useId, useState } from 'react'
import { UploadIcon, XIcon } from '../../../components/ui/icons.tsx'
import { Modal } from '../../../components/ui/Modal.tsx'
import { RadioChoice as Choice } from '../../../components/ui/RadioChoice.tsx'
import type { SageOrder, SageOrderExportLayout } from '../../../lib/api/sageOrders.ts'
import type { ExportFileFormat } from '../../../lib/csv.ts'
import type { SageOrderFilters } from '../hooks/useSageOrders.ts'
import {
  buildSageOrderExportParams,
  type SageOrderExportScope,
  type SageOrdersExportRequest,
} from '../utils/exportRequest.ts'

interface SageOrdersExportDialogProps {
  /** The orders on the page being shown. */
  items: readonly SageOrder[]
  /** The list's search and filters. */
  filters: SageOrderFilters
  /** How many orders match them, across every page. */
  total: number
  onClose: () => void
  onExport: (request: SageOrdersExportRequest) => void
}

const number = (value: number) => value.toLocaleString('en-GB')
const plural = (count: number) => `${number(count)} ${count === 1 ? 'order' : 'orders'}`

const GROUP_TITLE = 'text-[0.95rem] font-semibold'

/**
 * The Sage orders export dialog, laid out like the products, Orders and Sage customers ones: which orders
 * (this page, all, or those matching the search and filters), how the file is laid out (one row per order
 * line or one per order — the API's `layout`) and the kind of CSV. "Export orders" sends nothing itself —
 * it hands the request to `SageOrdersExport`, which calls `GET /sage/orders/export`.
 */
export function SageOrdersExportDialog({
  items,
  filters,
  total,
  onClose,
  onExport,
}: SageOrdersExportDialogProps) {
  const base = useId()
  const canMatch = total > 0

  const [scope, setScope] = useState<SageOrderExportScope>('page')
  const [layout, setLayout] = useState<SageOrderExportLayout>('lines')
  const [format, setFormat] = useState<ExportFileFormat>('excel')

  const count = scope === 'page' ? items.length : scope === 'matching' ? total : null
  const canExport =
    scope === 'page' ? items.length > 0 : scope === 'matching' ? canMatch : true

  function submit() {
    if (!canExport) return
    onExport({
      params: buildSageOrderExportParams(scope, layout, items, filters),
      format,
      summary: count === null ? 'all orders' : plural(count),
    })
  }

  return (
    <Modal label="Export orders" onClose={onClose}>
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-[1.15rem] leading-tight font-semibold">Export orders</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="border-border text-text-muted hover:border-accent hover:text-text -mt-1 -mr-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border bg-transparent transition-colors"
          >
            <XIcon width={16} height={16} />
          </button>
        </div>

        <p className="text-text-muted text-[0.9rem] leading-relaxed">
          This CSV file has the Sage sales orders and can be opened in a spreadsheet.
        </p>

        <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-none p-0">
          <legend className={`${GROUP_TITLE} mb-1.5`}>Export</legend>
          <Choice
            name={`${base}-scope`}
            value="page"
            checked={scope === 'page'}
            disabled={items.length === 0}
            onSelect={() => setScope('page')}
          >
            Current page
          </Choice>
          <Choice
            name={`${base}-scope`}
            value="all"
            checked={scope === 'all'}
            onSelect={() => setScope('all')}
            hint="Every Sage order, whatever the search and filters"
          >
            All orders
          </Choice>
          <Choice
            name={`${base}-scope`}
            value="matching"
            checked={scope === 'matching'}
            disabled={!canMatch}
            onSelect={() => setScope('matching')}
            hint="The list’s status, search and filters, across every page"
          >
            {plural(total)} matching your search and filters
          </Choice>
        </fieldset>

        <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-none p-0">
          <legend className={`${GROUP_TITLE} mb-1.5`}>Layout</legend>
          <Choice
            name={`${base}-layout`}
            value="lines"
            checked={layout === 'lines'}
            onSelect={() => setLayout('lines')}
            hint="The order’s details are repeated on each line"
          >
            One row per order line
          </Choice>
          <Choice
            name={`${base}-layout`}
            value="orders"
            checked={layout === 'orders'}
            onSelect={() => setLayout('orders')}
          >
            One row per order
          </Choice>
        </fieldset>

        <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-none p-0">
          <legend className={`${GROUP_TITLE} mb-1.5`}>Export as</legend>
          <Choice
            name={`${base}-format`}
            value="excel"
            checked={format === 'excel'}
            onSelect={() => setFormat('excel')}
          >
            CSV for Excel, Numbers, or other spreadsheet programs
          </Choice>
          <Choice
            name={`${base}-format`}
            value="plain"
            checked={format === 'plain'}
            onSelect={() => setFormat('plain')}
          >
            Plain CSV file
          </Choice>
        </fieldset>

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="border-border bg-bg text-text hover:border-accent h-10 cursor-pointer rounded-full border px-5 text-[0.88rem] font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canExport}
            onClick={submit}
            className="bg-accent text-accent-contrast hover:bg-accent-hover inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border-none px-5 text-[0.88rem] font-semibold shadow-sm transition-colors disabled:pointer-events-none disabled:opacity-50"
          >
            <UploadIcon width={16} height={16} />
            Export orders
          </button>
        </div>
      </div>
    </Modal>
  )
}
