import { useId, useState } from 'react'
import { UploadIcon, XIcon } from '../../../components/ui/icons.tsx'
import { Modal } from '../../../components/ui/Modal.tsx'
import { RadioChoice as Choice } from '../../../components/ui/RadioChoice.tsx'
import type { SageStockItem } from '../../../lib/api/sageStock.ts'
import type { ExportFileFormat } from '../../../lib/csv.ts'
import type { SageStockFilters } from '../hooks/useSageStock.ts'
import {
  buildSageStockExportParams,
  type SageStockExportRequest,
  type SageStockExportScope,
} from '../utils/exportRequest.ts'

interface SageStockExportDialogProps {
  /** The stock items on the page being shown. */
  items: readonly SageStockItem[]
  /** The list's search and filters. */
  filters: SageStockFilters
  /** How many items match them, across every page. */
  total: number
  onClose: () => void
  onExport: (request: SageStockExportRequest) => void
}

const number = (value: number) => value.toLocaleString('en-GB')
const plural = (count: number) =>
  `${number(count)} ${count === 1 ? 'stock item' : 'stock items'}`

const GROUP_TITLE = 'text-[0.95rem] font-semibold'

/**
 * The Sage stock export dialog, laid out like the Sage customers', Orders and Products ones: which
 * items (this page, all, or those matching the search and filters) and the kind of CSV. "Export stock"
 * sends nothing itself — it hands the request to `SageStockExport`, which calls `GET /sage/stock/export`.
 */
export function SageStockExportDialog({
  items,
  filters,
  total,
  onClose,
  onExport,
}: SageStockExportDialogProps) {
  const base = useId()
  const canMatch = total > 0

  const [scope, setScope] = useState<SageStockExportScope>('page')
  const [format, setFormat] = useState<ExportFileFormat>('excel')

  const count = scope === 'page' ? items.length : scope === 'matching' ? total : null
  const canExport =
    scope === 'page' ? items.length > 0 : scope === 'matching' ? canMatch : true

  function submit() {
    if (!canExport) return
    onExport({
      params: buildSageStockExportParams(scope, items, filters),
      format,
      summary: count === null ? 'all stock items' : plural(count),
    })
  }

  return (
    <Modal label="Export stock" onClose={onClose}>
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-[1.15rem] leading-tight font-semibold">Export stock</h2>
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
          This CSV file has the Sage stock items you choose below, as the backend builds
          it.
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
            hint="Every Sage stock item, whatever the search and filters"
          >
            All stock items
          </Choice>
          <Choice
            name={`${base}-scope`}
            value="matching"
            checked={scope === 'matching'}
            disabled={!canMatch}
            onSelect={() => setScope('matching')}
            hint="The list’s stock status, search and filters, across every page"
          >
            {plural(total)} matching your search and filters
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
            Export stock
          </button>
        </div>
      </div>
    </Modal>
  )
}
