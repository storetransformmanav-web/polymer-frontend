import { useId, useState, type ReactNode } from 'react'
import type { ProductFilters } from '../../../app/store/productsSlice.ts'
import { UploadIcon, XIcon } from '../../../components/ui/icons.tsx'
import { Modal } from '../../../components/ui/Modal.tsx'
import type { ProductListItem } from '../../../lib/api/endpoints.ts'
import {
  buildExportParams,
  hasExportableFilters,
  hasUnsupportedFilters,
  type ExportFileFormat,
  type ExportScope,
  type ProductsExportRequest,
} from '../utils/exportRequest.ts'

interface ProductsExportDialogProps {
  /** The products on the page being shown. */
  items: readonly ProductListItem[]
  /** The ticked products on that page. */
  selected: readonly ProductListItem[]
  /** The list's search and filters. */
  filters: ProductFilters
  /** How many products match them, across every page. */
  total: number
  onClose: () => void
  onExport: (request: ProductsExportRequest) => void
}

const number = (value: number) => value.toLocaleString('en-GB')
const plural = (count: number) =>
  `${number(count)} ${count === 1 ? 'product' : 'products'}`

const GROUP_TITLE = 'text-[0.95rem] font-semibold'

interface ChoiceProps {
  name: string
  value: string
  checked: boolean
  disabled?: boolean
  onSelect: () => void
  children: ReactNode
  /** A smaller line under the label. */
  hint?: string
}

/** One radio of a group: the circle, its label and an optional hint. */
function Choice({
  name,
  value,
  checked,
  disabled,
  onSelect,
  children,
  hint,
}: ChoiceProps) {
  return (
    <label
      className={`flex items-start gap-3 py-1 text-[0.92rem] ${
        disabled ? 'text-text-muted/60 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="accent-accent mt-[0.2rem] h-4 w-4 shrink-0 cursor-[inherit]"
      />
      <span className="flex flex-col">
        <span>{children}</span>
        {hint && <span className="text-text-muted text-[0.78rem]">{hint}</span>}
      </span>
    </label>
  )
}

/**
 * The products export dialog, laid out like the store admin's: which products (this
 * page, all, the ticked ones, or those matching the search), and the kind of CSV.
 * "Export products" sends nothing itself — it hands the request to `ProductsExport`,
 * which calls `GET /products/export`.
 */
export function ProductsExportDialog({
  items,
  selected,
  filters,
  total,
  onClose,
  onExport,
}: ProductsExportDialogProps) {
  const base = useId()
  const hasFilters = hasExportableFilters(filters)
  const unsupported = hasUnsupportedFilters(filters)
  const canMatch = hasFilters && !unsupported && total > 0

  const [scope, setScope] = useState<ExportScope>(
    selected.length > 0 ? 'selected' : 'page',
  )
  const [format, setFormat] = useState<ExportFileFormat>('excel')
  const [metafields, setMetafields] = useState(true)

  const count =
    scope === 'page'
      ? items.length
      : scope === 'selected'
        ? selected.length
        : scope === 'matching'
          ? total
          : null
  const canExport =
    scope === 'page'
      ? items.length > 0
      : scope === 'selected'
        ? selected.length > 0
        : scope === 'matching'
          ? canMatch
          : true

  function submit() {
    if (!canExport) return
    onExport({
      params: buildExportParams(scope, { items, selected, filters }, metafields),
      format,
      summary: count === null ? 'all products' : plural(count),
    })
  }

  return (
    <Modal label="Export products" onClose={onClose}>
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-[1.15rem] leading-tight font-semibold">Export products</h2>
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
          This CSV file has the same columns as the store admin&apos;s product export, so
          it can be opened in a spreadsheet or imported back into the store. It holds
          product information, not inventory quantities.
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
            All products
          </Choice>
          <Choice
            name={`${base}-scope`}
            value="selected"
            checked={scope === 'selected'}
            disabled={selected.length === 0}
            onSelect={() => setScope('selected')}
          >
            Selected: {plural(selected.length)}
          </Choice>
          <Choice
            name={`${base}-scope`}
            value="matching"
            checked={scope === 'matching'}
            disabled={!canMatch}
            onSelect={() => setScope('matching')}
            hint={
              unsupported
                ? 'Stock and price filters can’t be used in an export.'
                : undefined
            }
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
          <label className="mt-2 flex cursor-pointer items-start gap-3 py-1 text-[0.92rem]">
            <input
              type="checkbox"
              checked={metafields}
              onChange={(event) => setMetafields(event.target.checked)}
              className="accent-accent mt-[0.2rem] h-4 w-4 shrink-0 cursor-pointer"
            />
            <span className="flex flex-col">
              <span>Include metafields</span>
              <span className="text-text-muted text-[0.78rem]">
                Adds a column for every product metafield. Leave it off for a smaller,
                faster file.
              </span>
            </span>
          </label>
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
            Export products
          </button>
        </div>
      </div>
    </Modal>
  )
}
