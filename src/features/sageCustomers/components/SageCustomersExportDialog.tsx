import { useId, useState } from 'react'
import { UploadIcon, XIcon } from '../../../components/ui/icons.tsx'
import { Modal } from '../../../components/ui/Modal.tsx'
import { RadioChoice as Choice } from '../../../components/ui/RadioChoice.tsx'
import type { SageCustomer } from '../../../lib/api/sageCustomers.ts'
import type { ExportFileFormat } from '../../../lib/csv.ts'
import type { SageCustomerFilters } from '../hooks/useSageCustomers.ts'
import {
  buildSageCustomerExportParams,
  type SageCustomerExportScope,
  type SageCustomersExportRequest,
} from '../utils/exportRequest.ts'

interface SageCustomersExportDialogProps {
  /** The customers on the page being shown. */
  items: readonly SageCustomer[]
  /** The list's search and filters. */
  filters: SageCustomerFilters
  /** How many customers match them, across every page. */
  total: number
  onClose: () => void
  onExport: (request: SageCustomersExportRequest) => void
}

const number = (value: number) => value.toLocaleString('en-GB')
const plural = (count: number) =>
  `${number(count)} ${count === 1 ? 'customer' : 'customers'}`

const GROUP_TITLE = 'text-[0.95rem] font-semibold'

/**
 * The Sage customers export dialog, laid out like the Orders, Customers and Products ones: which
 * customers (this page, all, or those matching the search and filters) and the kind of CSV. "Export
 * customers" sends nothing itself — it hands the request to `SageCustomersExport`, which calls
 * `GET /sage/customers/export`.
 */
export function SageCustomersExportDialog({
  items,
  filters,
  total,
  onClose,
  onExport,
}: SageCustomersExportDialogProps) {
  const base = useId()
  const canMatch = total > 0

  const [scope, setScope] = useState<SageCustomerExportScope>('page')
  const [format, setFormat] = useState<ExportFileFormat>('excel')

  const count = scope === 'page' ? items.length : scope === 'matching' ? total : null
  const canExport =
    scope === 'page' ? items.length > 0 : scope === 'matching' ? canMatch : true

  function submit() {
    if (!canExport) return
    onExport({
      params: buildSageCustomerExportParams(scope, items, filters),
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
          This CSV file has the Sage customers’ contact details, addresses, credit terms,
          balance and aged debt, turnover, key dates and matching CRM customer. Bank
          details are never included.
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
            hint="Every Sage customer, whatever the search and filters"
          >
            All customers
          </Choice>
          <Choice
            name={`${base}-scope`}
            value="matching"
            checked={scope === 'matching'}
            disabled={!canMatch}
            onSelect={() => setScope('matching')}
            hint="The list’s tab, search and filters, across every page"
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
            Export customers
          </button>
        </div>
      </div>
    </Modal>
  )
}
