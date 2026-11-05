import { useId, useState } from 'react'
import type { CustomerFilters } from '../../../app/store/customersSlice.ts'
import { UploadIcon, XIcon } from '../../../components/ui/icons.tsx'
import { Modal } from '../../../components/ui/Modal.tsx'
import { RadioChoice as Choice } from '../../../components/ui/RadioChoice.tsx'
import type { CustomerListItem } from '../../../lib/api/endpoints.ts'
import type { ExportFileFormat } from '../../../lib/csv.ts'
import {
  buildCustomerExportParams,
  hasExportableFilters,
  type CustomerExportScope,
  type CustomersExportRequest,
} from '../utils/exportRequest.ts'

interface CustomersExportDialogProps {
  /** The customers on the page being shown. */
  items: readonly CustomerListItem[]
  /** The list's search and filters. */
  filters: CustomerFilters
  /** How many customers match them, across every page. */
  total: number
  onClose: () => void
  onExport: (request: CustomersExportRequest) => void
}

const number = (value: number) => value.toLocaleString('en-GB')
const plural = (count: number) =>
  `${number(count)} ${count === 1 ? 'customer' : 'customers'}`

const GROUP_TITLE = 'text-[0.95rem] font-semibold'

/**
 * The customers export dialog, laid out like the products one: which customers (this page,
 * all, or those matching the search) and the kind of CSV. "Export customers" sends nothing
 * itself — it hands the request to `CustomersExport`, which calls `GET /customer/export`.
 */
export function CustomersExportDialog({
  items,
  filters,
  total,
  onClose,
  onExport,
}: CustomersExportDialogProps) {
  const base = useId()
  const canMatch = hasExportableFilters(filters) && total > 0

  const [scope, setScope] = useState<CustomerExportScope>('page')
  const [format, setFormat] = useState<ExportFileFormat>('excel')

  const count = scope === 'page' ? items.length : scope === 'matching' ? total : null
  const canExport =
    scope === 'page' ? items.length > 0 : scope === 'matching' ? canMatch : true

  function submit() {
    if (!canExport) return
    onExport({
      params: buildCustomerExportParams(scope, items, filters),
      format,
      summary: count === null ? 'all customers' : plural(count),
    })
  }

  return (
    <Modal label="Export customers" onClose={onClose}>
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-[1.15rem] leading-tight font-semibold">Export customers</h2>
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
          This CSV file can be opened in a spreadsheet or imported back into the store.
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
            hint={filters.shop ? 'From the store chosen at the top' : 'From every store'}
          >
            All customers
          </Choice>
          <Choice
            name={`${base}-scope`}
            value="matching"
            checked={scope === 'matching'}
            disabled={!canMatch}
            onSelect={() => setScope('matching')}
          >
            {plural(total)} matching your search
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
            Export customers
          </button>
        </div>
      </div>
    </Modal>
  )
}
