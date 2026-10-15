import { Fragment, useMemo, useState } from 'react'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ColumnsIcon,
  SpinnerIcon,
} from '../../../components/ui/icons.tsx'
import { PopoverButton } from '../../../components/ui/PopoverButton.tsx'
import {
  PRODUCT_EDIT_STATUSES,
  type ProductListItem,
} from '../../../lib/api/endpoints.ts'
import { type BulkRow, type BulkSavedItem, useBulkEdit } from '../hooks/useBulkEdit.ts'
import {
  draftFromProduct,
  type ProductDraft,
  type VariantDraft,
} from '../utils/editDraft.ts'
import { statusLabel } from '../utils/format.ts'
import { ProductImage } from './ProductImage.tsx'

type ColumnId =
  'status' | 'vendor' | 'productType' | 'price' | 'compareAtPrice' | 'sku' | 'barcode'

interface Column {
  id: ColumnId
  label: string
  /** Product columns edit the product; variant columns edit each of its variants. */
  level: 'product' | 'variant'
  width: string
}

const COLUMNS: Column[] = [
  { id: 'status', label: 'Status', level: 'product', width: 'w-40' },
  { id: 'vendor', label: 'Vendor', level: 'product', width: 'w-56' },
  { id: 'productType', label: 'Product type', level: 'product', width: 'w-52' },
  { id: 'price', label: 'Price', level: 'variant', width: 'w-36' },
  { id: 'compareAtPrice', label: 'Compare-at price', level: 'variant', width: 'w-44' },
  { id: 'sku', label: 'SKU', level: 'variant', width: 'w-48' },
  { id: 'barcode', label: 'Barcode', level: 'variant', width: 'w-48' },
]
const DEFAULT_COLUMNS: ColumnId[] = ['status', 'vendor', 'productType', 'price']

const NUMERIC: ColumnId[] = ['price', 'compareAtPrice']

const TH =
  'text-text-muted border-border bg-surface sticky top-0 z-[2] border-b px-3 py-2.5 text-left text-[0.8rem] font-semibold whitespace-nowrap'
const TD = 'border-border border-b border-l p-0 align-middle first:border-l-0'

const CELL =
  'h-10 w-full min-w-0 border-none bg-transparent px-3 text-[0.85rem] outline-none transition-colors focus:bg-bg focus:outline-2 focus:-outline-offset-2 focus:outline-accent disabled:opacity-60'

function Dash() {
  return <span className="text-text-muted/60 block px-3 text-[0.85rem]">—</span>
}

interface CellProps {
  label: string
  value: string
  /** The value when editing began — a cell that differs is highlighted. */
  original: string
  error?: string
  numeric?: boolean
  maxLength?: number
  onChange: (value: string) => void
}

function TextCell({
  label,
  value,
  original,
  error,
  numeric,
  maxLength,
  onChange,
}: CellProps) {
  const changed = value !== original
  return (
    <input
      aria-label={label}
      aria-invalid={error ? true : undefined}
      title={error}
      value={value}
      maxLength={maxLength}
      inputMode={numeric ? 'decimal' : undefined}
      autoComplete="off"
      onChange={(event) => onChange(event.target.value)}
      className={`${CELL} ${numeric ? 'text-right' : ''} ${
        error ? 'outline-danger bg-danger-bg outline-2 -outline-offset-2' : ''
      } ${changed && !error ? 'bg-accent-tint/60' : ''}`}
    />
  )
}

function StatusCell({
  label,
  value,
  original,
  onChange,
}: {
  label: string
  value: string
  original: string
  onChange: (value: string) => void
}) {
  const known = PRODUCT_EDIT_STATUSES.some((status) => status === value)
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${CELL} cursor-pointer appearance-none pr-8 ${
          value !== original ? 'bg-accent-tint/60' : ''
        }`}
      >
        {/* A status the API can't set (e.g. Unlisted) is shown, but can only be moved away from. */}
        {!known && (
          <option value={value} disabled>
            {statusLabel(value)}
          </option>
        )}
        {PRODUCT_EDIT_STATUSES.map((status) => (
          <option key={status} value={status}>
            {statusLabel(status)}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        width={14}
        height={14}
        className="text-text-muted pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
      />
    </div>
  )
}

/** What the last Save did to the row, or that it has unsaved changes. */
function ResultCell({ row }: { row: BulkRow }) {
  const { result } = row
  if (result?.state === 'saving') {
    return (
      <span className="text-text-muted flex items-center gap-1.5 px-3 text-[0.8rem]">
        <SpinnerIcon width={14} height={14} className="animate-spin" />
        Saving…
      </span>
    )
  }
  if (result?.state === 'error') {
    return (
      <span
        role="alert"
        title={result.message}
        className="text-danger flex items-start gap-1.5 px-3 py-1.5 text-[0.78rem] leading-snug"
      >
        <AlertTriangleIcon width={14} height={14} className="mt-px shrink-0" />
        <span className="line-clamp-2">{result.message}</span>
      </span>
    )
  }
  if (result?.state === 'saved') {
    return (
      <span
        title={result.message}
        className="text-accent flex items-center gap-1.5 px-3 text-[0.8rem] font-semibold"
      >
        <CheckCircleIcon width={14} height={14} />
        Saved
      </span>
    )
  }
  if (row.dirty) {
    return <span className="text-warning px-3 text-[0.8rem] font-semibold">Edited</span>
  }
  return null
}

interface RowsProps {
  row: BulkRow
  preview: ProductListItem | undefined
  columns: Column[]
  expanded: boolean
  onToggle: () => void
  edit: ReturnType<typeof useBulkEdit>
}

/** One product: its own row, then one row per variant when the variants are expanded. */
function ProductRows({ row, preview, columns, expanded, onToggle, edit }: RowsProps) {
  // The values the row started from, to highlight what was changed.
  const original = useMemo(
    () => (row.product ? draftFromProduct(row.product) : null),
    [row.product],
  )
  const span = columns.length + 2

  if (!row.product || !row.draft || !original) {
    return (
      <tr className="border-border border-b">
        <td className={`${TD} px-3 py-2.5`}>
          <div className="flex items-center gap-3">
            <ProductImage src={preview?.image_url ?? null} alt="" />
            <span className="text-text-muted truncate text-[0.85rem]">
              {preview?.title ?? 'Loading…'}
            </span>
          </div>
        </td>
        {row.loadError ? (
          <td colSpan={span - 1} className={`${TD} px-3`}>
            <span className="text-danger flex flex-wrap items-center gap-3 text-[0.82rem]">
              {row.loadError}
              <button
                type="button"
                onClick={() => edit.retryLoad(row.id)}
                className="border-border bg-bg text-text hover:border-accent cursor-pointer rounded-md border px-2.5 py-1 text-[0.78rem] font-semibold"
              >
                Retry
              </button>
            </span>
          </td>
        ) : (
          <td colSpan={span - 1} className={`${TD} px-3`}>
            <div
              role="status"
              aria-label="Loading"
              className="bg-border/70 h-4 w-48 animate-pulse rounded"
            />
          </td>
        )}
      </tr>
    )
  }

  const { product, draft } = row
  const variants = draft.variants
  const hasVariantColumns = columns.some((column) => column.level === 'variant')
  // One variant is edited right on the product row; more are listed underneath.
  const inline = variants.length <= 1
  const expandable = !inline && hasVariantColumns
  const showVariants = expandable && expanded

  const setProduct = (patch: Partial<ProductDraft>) => edit.change(row.id, patch)
  const setVariant = (variant: VariantDraft, patch: Partial<VariantDraft>) =>
    edit.changeVariant(row.id, variant.key, patch)

  const productValue = (id: ColumnId): [string, string] | null => {
    if (id === 'status') return [draft.status, original.status]
    if (id === 'vendor') return [draft.vendor, original.vendor]
    if (id === 'productType') return [draft.productType, original.productType]
    return null
  }

  const variantValue = (variant: VariantDraft, id: ColumnId): [string, string] => {
    const before = original.variants.find((candidate) => candidate.key === variant.key)
    switch (id) {
      case 'price':
        return [variant.price, before?.price ?? '']
      case 'compareAtPrice':
        return [variant.compareAtPrice, before?.compareAtPrice ?? '']
      case 'sku':
        return [variant.sku, before?.sku ?? '']
      default:
        return [variant.barcode, before?.barcode ?? '']
    }
  }

  const variantIndex = (variant: VariantDraft) => variants.indexOf(variant)
  const variantPatch = (id: ColumnId, value: string): Partial<VariantDraft> => {
    if (id === 'price') return { price: value }
    if (id === 'compareAtPrice') return { compareAtPrice: value }
    if (id === 'sku') return { sku: value }
    return { barcode: value }
  }
  const variantErrorKey = (id: ColumnId, variant: VariantDraft) =>
    `variants.${variantIndex(variant)}.${id}`

  function variantCell(column: Column, variant: VariantDraft, name: string) {
    const [value, before] = variantValue(variant, column.id)
    return (
      <TextCell
        label={`${column.label} for ${name}`}
        value={value}
        original={before}
        numeric={NUMERIC.includes(column.id)}
        maxLength={column.id === 'sku' || column.id === 'barcode' ? 255 : 20}
        error={row.errors[variantErrorKey(column.id, variant)]}
        onChange={(next) => setVariant(variant, variantPatch(column.id, next))}
      />
    )
  }

  return (
    <Fragment>
      <tr className="border-border hover:bg-accent-tint/30 border-b">
        <td className={TD}>
          <div className="flex items-center gap-2 pl-3">
            <ProductImage src={product.featured_image_url ?? null} alt="" />
            <div className="min-w-0 flex-1">
              <TextCell
                label={`Title for ${product.title}`}
                value={draft.title}
                original={original.title}
                maxLength={255}
                error={row.errors.title}
                onChange={(title) => setProduct({ title })}
              />
            </div>
            {expandable && (
              <button
                type="button"
                onClick={onToggle}
                aria-expanded={expanded}
                aria-label={`${expanded ? 'Hide' : 'Show'} ${variants.length} variants of ${product.title}`}
                className="text-text-muted hover:text-accent mr-2 inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent"
              >
                <ChevronDownIcon
                  width={16}
                  height={16}
                  className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
                />
              </button>
            )}
          </div>
        </td>

        {columns.map((column) => {
          if (column.level === 'product') {
            const [value, before] = productValue(column.id) ?? ['', '']
            return (
              <td key={column.id} className={TD}>
                {column.id === 'status' ? (
                  <StatusCell
                    label={`Status for ${product.title}`}
                    value={value}
                    original={before}
                    onChange={(status) => setProduct({ status })}
                  />
                ) : (
                  <TextCell
                    label={`${column.label} for ${product.title}`}
                    value={value}
                    original={before}
                    maxLength={255}
                    error={row.errors[column.id]}
                    onChange={(next) =>
                      setProduct(
                        column.id === 'vendor' ? { vendor: next } : { productType: next },
                      )
                    }
                  />
                )}
              </td>
            )
          }
          return (
            <td key={column.id} className={TD}>
              {inline && variants[0] ? (
                variantCell(column, variants[0], product.title)
              ) : (
                <Dash />
              )}
            </td>
          )
        })}

        <td className={TD}>
          <ResultCell row={row} />
        </td>
      </tr>

      {showVariants &&
        variants.map((variant) => (
          <tr key={variant.key} className="border-border bg-surface/50 border-b">
            <td
              className={`${TD} text-text-muted truncate py-2 pr-3 pl-16 text-[0.85rem]`}
            >
              {variant.title}
            </td>
            {columns.map((column) => (
              <td key={column.id} className={TD}>
                {column.level === 'variant' ? (
                  variantCell(column, variant, `${product.title} – ${variant.title}`)
                ) : (
                  <Dash />
                )}
              </td>
            ))}
            <td className={TD} />
          </tr>
        ))}
    </Fragment>
  )
}

interface BulkEditViewProps {
  /** The products being edited, in order (the list rows — shown while details load). */
  items: ProductListItem[]
  onBack: () => void
  /** Called with the products that were saved, so the page can follow their store push. */
  onSaved: (saved: BulkSavedItem[]) => void
}

/**
 * The spreadsheet-style bulk editor: every chosen product is a row, with
 * editable cells (title, status, vendor, type, and the price/SKU of each
 * variant underneath). Nothing is sent until Save; each changed product is then
 * saved on its own, so one failure never loses the others.
 */
export function BulkEditView({ items, onBack, onSaved }: BulkEditViewProps) {
  const ids = useMemo(() => items.map((item) => item.id), [items])
  const edit = useBulkEdit(ids)
  const [visible, setVisible] = useState<ColumnId[]>(DEFAULT_COLUMNS)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [summary, setSummary] = useState<{
    tone: 'success' | 'error'
    text: string
  } | null>(null)
  const previews = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const columns = COLUMNS.filter((column) => visible.includes(column.id))
  const currency = edit.rows.find((row) => row.product?.currency)?.product?.currency

  const plural = (count: number, word: string) =>
    `${count} ${word}${count === 1 ? '' : 's'}`

  function back() {
    if (edit.dirtyCount > 0) {
      const sure = window.confirm(
        `Discard the unsaved changes to ${plural(edit.dirtyCount, 'product')}?`,
      )
      if (!sure) return
    }
    onBack()
  }

  async function save() {
    setSummary(null)
    const outcome = await edit.saveAll()
    if (outcome.blocked > 0) {
      setSummary({
        tone: 'error',
        text: `Fix the highlighted cells in ${plural(outcome.blocked, 'product')} to save. Nothing was sent.`,
      })
      return
    }
    if (outcome.saved.length > 0) onSaved(outcome.saved)
    if (outcome.failed > 0) {
      setSummary({
        tone: 'error',
        text: `Saved ${outcome.saved.length} of ${outcome.saved.length + outcome.failed} products. ${plural(outcome.failed, 'product')} could not be saved — they keep your changes, so you can try again.`,
      })
    } else if (outcome.saved.length > 0) {
      setSummary({
        tone: 'success',
        text: `Saved ${plural(outcome.saved.length, 'product')}. They are being sent to the store.`,
      })
    }
  }

  function toggleColumn(id: ColumnId) {
    setVisible((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  function toggleRow(id: string) {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section
      aria-label="Bulk edit"
      className="border-border bg-bg flex flex-col rounded-2xl border"
    >
      <div className="border-border flex flex-wrap items-center gap-x-4 gap-y-2 rounded-t-2xl border-b px-4 py-2.5">
        <button
          type="button"
          onClick={back}
          className="text-text hover:text-accent inline-flex h-9 cursor-pointer items-center gap-2 border-none bg-transparent px-1 text-[0.85rem] font-semibold transition-colors"
        >
          <ArrowLeftIcon width={16} height={16} />
          Back
        </button>
        <div className="bg-border hidden h-6 w-px sm:block" aria-hidden="true" />
        <h2 className="text-[0.95rem] font-semibold">
          Editing {plural(items.length, 'product')}
        </h2>
        {edit.dirtyCount > 0 && (
          <span className="text-warning text-[0.8rem] font-semibold">
            {edit.dirtyCount} unsaved
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <PopoverButton label="Columns" icon={ColumnsIcon} align="right">
            {() => (
              <div className="flex flex-col">
                <p className="text-text-muted px-2.5 pt-1.5 pb-1 text-[0.72rem] font-bold tracking-wide uppercase">
                  Show columns
                </p>
                {COLUMNS.map((column) => (
                  <label
                    key={column.id}
                    className="hover:bg-accent-tint/60 flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.85rem]"
                  >
                    <input
                      type="checkbox"
                      checked={visible.includes(column.id)}
                      onChange={() => toggleColumn(column.id)}
                      className="accent-accent h-4 w-4 cursor-pointer"
                    />
                    {column.label}
                    {column.level === 'variant' && (
                      <span className="text-text-muted ml-auto text-[0.72rem]">
                        per variant
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </PopoverButton>

          <button
            type="button"
            onClick={() => void save()}
            disabled={edit.dirtyCount === 0 || edit.isSaving}
            className="bg-accent text-accent-contrast hover:bg-accent-hover inline-flex h-9 min-w-20 cursor-pointer items-center justify-center gap-2 rounded-lg border-none px-4 text-[0.85rem] font-semibold shadow-sm transition-colors disabled:pointer-events-none disabled:opacity-50"
          >
            {edit.isSaving && (
              <SpinnerIcon width={14} height={14} className="animate-spin" />
            )}
            Save
          </button>
        </div>
      </div>

      {summary && (
        <div className="px-4 pt-3">
          <FormMessage tone={summary.tone}>{summary.text}</FormMessage>
        </div>
      )}

      <div className="max-h-[min(72svh,820px)] overflow-auto rounded-b-2xl">
        <table className="w-full min-w-[760px] border-collapse text-[0.85rem]">
          <thead>
            <tr>
              <th className={`${TH} min-w-72`}>Product title</th>
              {columns.map((column) => (
                <th key={column.id} className={`${TH} ${column.width}`}>
                  {column.label}
                  {column.level === 'variant' && column.id === 'price' && currency && (
                    <span className="text-text-muted/70 ml-2 text-[0.72rem] font-medium">
                      {currency}
                    </span>
                  )}
                </th>
              ))}
              <th className={`${TH} w-44`}>
                <span className="sr-only">Result</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {edit.rows.map((row) => (
              <ProductRows
                key={row.id}
                row={row}
                preview={previews.get(row.id)}
                columns={columns}
                expanded={!collapsed.has(row.id)}
                onToggle={() => toggleRow(row.id)}
                edit={edit}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
