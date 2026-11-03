import { useMemo, useState } from 'react'
import { ConfirmCancelDialog } from '../../../../components/ui/ConfirmCancelDialog.tsx'
import { FormMessage } from '../../../../components/ui/FormMessage.tsx'
import { IconAction } from '../../../../components/ui/IconAction.tsx'
import { ArrowLeftIcon, CheckIcon, XIcon } from '../../../../components/ui/icons.tsx'
import type { ProductDetail } from '../../../../lib/api/endpoints.ts'
import { useSectionEdit, type SavedHandler } from '../../hooks/useSectionEdit.ts'
import { draftFromProduct, LIMITS, type VariantDraft } from '../../utils/editDraft.ts'
import { ConfirmUpdateDialog } from '../ConfirmUpdateDialog.tsx'
import { ProductImage } from '../ProductImage.tsx'

/** Every variant problem belongs to this editor. */
const BULK_ERRORS = ['variants'] as const

type ColumnId =
  'price' | 'compareAtPrice' | 'cost' | 'sku' | 'barcode' | 'stock' | 'weight'

const COLUMNS: { id: ColumnId; label: string; width: string; numeric?: boolean }[] = [
  { id: 'price', label: 'Price', width: 'w-32', numeric: true },
  { id: 'compareAtPrice', label: 'Compare-at price', width: 'w-36', numeric: true },
  { id: 'cost', label: 'Cost per item', width: 'w-32', numeric: true },
  { id: 'sku', label: 'SKU', width: 'w-44' },
  { id: 'barcode', label: 'Barcode', width: 'w-44' },
  { id: 'stock', label: 'Inventory', width: 'w-28', numeric: true },
  { id: 'weight', label: 'Weight', width: 'w-28', numeric: true },
]
/** What the "All variants" row can set for every variant: not SKU, barcode, stock or weight. */
const COMMON: ColumnId[] = ['price', 'compareAtPrice', 'cost']

// The same table as the products' bulk editor.
const TH =
  'text-text-muted border-border bg-surface sticky top-0 z-[2] border-b px-3 py-2.5 text-left text-[0.8rem] font-semibold whitespace-nowrap'
const TD = 'border-border border-b border-l p-0 align-middle first:border-l-0'
const CELL =
  'h-10 w-full min-w-0 border-none bg-transparent px-3 text-[0.85rem] outline-none transition-colors focus:bg-bg focus:outline-2 focus:-outline-offset-2 focus:outline-accent disabled:opacity-60'
/**
 * A cell of the spreadsheet. It reads as plain text — no box, no colour — and only tints when the
 * pointer is over it (light) or it is clicked / focused (stronger); a **double-click** (or Enter, or
 * F2) turns it into a box to type in, and Enter, Escape or leaving the box turns it back. A changed
 * value is drawn bold in the accent colour, a refused one in red.
 */
function BulkCell({
  value,
  label,
  error,
  changed,
  numeric,
  disabled,
  maxLength,
  onChange,
}: {
  value: string
  label: string
  error?: string
  changed: boolean
  numeric: boolean
  disabled: boolean
  maxLength: number
  onChange: (value: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const side = numeric ? 'text-right' : 'text-left'
  if (editing) {
    return (
      <input
        autoFocus
        aria-label={label}
        aria-invalid={error ? true : undefined}
        title={error}
        value={value}
        maxLength={maxLength}
        inputMode={numeric ? 'decimal' : undefined}
        autoComplete="off"
        disabled={disabled}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === 'Escape') {
            // Only this box: Escape must not leave the whole editor.
            event.preventDefault()
            event.stopPropagation()
            setEditing(false)
          }
        }}
        className={`${CELL} bg-accent-tint/70 ${side} ${
          error ? 'outline-danger bg-danger-bg outline-2 -outline-offset-2' : ''
        }`}
      />
    )
  }
  return (
    <button
      type="button"
      aria-label={label}
      title={error ?? 'Double-click to edit'}
      disabled={disabled}
      onDoubleClick={() => setEditing(true)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === 'F2') {
          event.preventDefault()
          setEditing(true)
        }
      }}
      className={`hover:bg-accent-tint/50 focus:bg-accent-tint/80 focus:outline-accent active:bg-accent-tint block h-10 w-full min-w-0 cursor-cell border-none bg-transparent px-3 text-[0.85rem] transition-colors outline-none focus:outline-2 focus:-outline-offset-2 disabled:opacity-60 ${side} ${
        error
          ? 'bg-danger-bg text-danger outline-danger outline-2 -outline-offset-2'
          : changed
            ? 'text-accent font-semibold'
            : ''
      }`}
    >
      {value === '' ? <span className="text-text-muted/60">{'—'}</span> : value}
    </button>
  )
}

const ROW =
  'border-border-strong bg-table-head/50 hover:bg-table-head/70 border-b border-t transition-colors'
const ROW_BAR = 'shadow-[inset_3px_0_0_var(--color-accent)]'

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`

/** A variant's value in a column, and the key of its problem. */
function cellOf(variant: VariantDraft, index: number, id: ColumnId) {
  if (id === 'stock') {
    return {
      value: variant.stock[0]?.available ?? '',
      error: `variants.${index}.stock.0.quantity`,
    }
  }
  return { value: variant[id], error: `variants.${index}.${id}` }
}

/**
 * **Bulk edit** of a product's variants, laid out like the products' bulk editor: a bar with
 * "Editing N variants", ✓ Save, ✕ Cancel and **Back to list**; then a spreadsheet — one row per
 * variant with its price, compare-at price, cost, SKU, barcode, stock and weight (stock for a variant kept at one
 * location; several locations are changed on the Inventory tab) — topped by an **All variants**
 * row whose price, compare-at and cost are applied to every row at once (a blank one changes
 * nothing). Changed cells are tinted; nothing is sent until Save, which checks the cells, asks
 * "Are you sure?" and sends one update with only what changed.
 */
export function VariantBulkEdit({
  product,
  ids,
  onSaved,
  onClose,
}: {
  product: ProductDetail
  /** The variants being edited, in table order. */
  ids: string[]
  onSaved?: SavedHandler
  onClose: () => void
}) {
  const edit = useSectionEdit(product, {
    errorPrefixes: BULK_ERRORS,
    onSaved: (result, saved, body) => {
      onSaved?.(result, saved, body)
      onClose()
    },
  })
  const [begun, setBegun] = useState(false)
  if (!begun) {
    setBegun(true)
    edit.start()
  }
  const [cancelling, setCancelling] = useState(false)
  const [common, setCommon] = useState<Record<string, string>>({})
  const original = useMemo(() => draftFromProduct(product), [product])
  const draft = edit.draft
  const rows = draft
    ? ids
        .map((id) => draft.variants.findIndex((variant) => variant.id === id))
        .filter((index) => index >= 0)
    : []
  const currency = product.currency

  const changedCount = draft
    ? rows.filter((index) =>
        COLUMNS.some(
          (column) =>
            cellOf(draft.variants[index], index, column.id).value !==
            cellOf(original.variants[index], index, column.id).value,
        ),
      ).length
    : 0

  function patchRows(
    indexes: number[],
    patch: (variant: VariantDraft) => Partial<VariantDraft>,
  ) {
    if (!draft) return
    edit.change({
      variants: draft.variants.map((variant, i) =>
        indexes.includes(i) ? { ...variant, ...patch(variant) } : variant,
      ),
    })
  }

  function setCell(index: number, id: ColumnId, value: string) {
    patchRows([index], (variant) =>
      id === 'stock'
        ? {
            stock: variant.stock.map((row, i) =>
              i === 0 ? { ...row, available: value } : row,
            ),
          }
        : { [id]: value },
    )
  }

  function setAll(id: ColumnId, value: string) {
    setCommon((current) => ({ ...current, [id]: value }))
    // Blank = leave every variant as it is.
    if (value.trim() === '') return
    patchRows(rows, () => ({ [id]: value }))
  }

  function cancel() {
    if (edit.dirty) setCancelling(true)
    else {
      edit.discard()
      onClose()
    }
  }

  return (
    <section
      aria-label="Bulk edit variants"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !edit.confirming && !cancelling) {
          event.stopPropagation()
          cancel()
        }
      }}
      className="border-border bg-bg flex flex-col rounded-2xl border"
    >
      <div className="border-border flex flex-wrap items-center gap-x-4 gap-y-2 rounded-t-2xl border-b px-4 py-2.5">
        <h3 className="text-[0.95rem] font-semibold">
          Editing {plural(rows.length, 'variant')}
        </h3>
        {changedCount > 0 && (
          <span className="text-warning text-[0.8rem] font-semibold">
            {changedCount} unsaved
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <IconAction
            label="Save"
            accessibleLabel="Save the variants"
            icon={CheckIcon}
            tone="primary"
            disabled={!edit.dirty}
            busy={edit.isSaving}
            onClick={edit.commit}
          />
          <IconAction
            label="Cancel"
            accessibleLabel="Cancel bulk editing"
            icon={XIcon}
            tone="danger"
            disabled={edit.isSaving}
            onClick={cancel}
          />
          <button
            type="button"
            onClick={cancel}
            disabled={edit.isSaving}
            aria-label="Back to list"
            className="border-border bg-bg text-text hover:border-accent flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[0.82rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50"
          >
            <ArrowLeftIcon width={16} height={16} />
            <span className="hidden sm:inline" aria-hidden="true">
              Back to list
            </span>
          </button>
        </div>
      </div>

      {(edit.error || (edit.showErrors && edit.hasProblems)) && (
        <div className="px-4 pt-3">
          <FormMessage tone="error">
            {edit.error ?? 'Fix the highlighted cells to save. Nothing was sent.'}
          </FormMessage>
        </div>
      )}

      <div className="max-h-[min(72svh,820px)] overflow-auto rounded-b-2xl">
        <table className="w-full min-w-[960px] border-collapse text-[0.85rem]">
          <thead>
            <tr>
              <th className={`${TH} min-w-60`}>Variant</th>
              {COLUMNS.map((column) => (
                <th key={column.id} className={`${TH} ${column.width}`}>
                  {column.label}
                  {column.id === 'price' && currency && (
                    <span className="text-text-muted/70 ml-2 text-[0.72rem] font-medium">
                      {currency}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length > 1 && (
              <tr className="border-border bg-accent-tint/40 border-b">
                <td className={`${TD} px-3 py-2`}>
                  <p className="text-[0.85rem] font-semibold">
                    All variants{' '}
                    <span className="text-text-muted font-normal">({rows.length})</span>
                  </p>
                  <p className="text-text-muted text-[0.72rem]">
                    Set a value here to apply it to every variant below.
                  </p>
                </td>
                {COLUMNS.map((column) => (
                  <td key={column.id} className={TD}>
                    {COMMON.includes(column.id) ? (
                      <input
                        aria-label={`${column.label} for all variants`}
                        value={common[column.id] ?? ''}
                        placeholder="Set for all…"
                        maxLength={20}
                        inputMode="decimal"
                        autoComplete="off"
                        onChange={(event) => setAll(column.id, event.target.value)}
                        className={`${CELL} placeholder:text-text-muted/70 text-right`}
                      />
                    ) : (
                      <span className="text-text-muted/60 block px-3">—</span>
                    )}
                  </td>
                ))}
              </tr>
            )}
            {draft &&
              rows.map((index) => {
                const variant = draft.variants[index]
                const before = original.variants[index]
                const source = product.variants[index]
                return (
                  <tr key={variant.key} className={ROW}>
                    <td className={`${TD} ${ROW_BAR}`}>
                      <div className="flex items-center gap-2.5 px-3 py-1.5">
                        <span className="border-border h-8 w-8 shrink-0 overflow-hidden border">
                          <ProductImage
                            src={source?.image_url ?? null}
                            alt=""
                            size="thumb"
                          />
                        </span>
                        <span className="truncate font-semibold" title={variant.title}>
                          {variant.title}
                        </span>
                      </div>
                    </td>
                    {COLUMNS.map((column) => {
                      // Stock is changed here only for a variant kept at one location.
                      if (
                        column.id === 'stock' &&
                        (!variant.tracked || variant.stock.length !== 1)
                      ) {
                        return (
                          <td key={column.id} className={TD}>
                            <span
                              className="text-text-muted/60 block px-3 text-right"
                              title="Several locations: change them on the Inventory tab"
                            >
                              —
                            </span>
                          </td>
                        )
                      }
                      const cell = cellOf(variant, index, column.id)
                      const was = cellOf(before, index, column.id).value
                      const error = edit.errors[cell.error]
                      return (
                        <td key={column.id} className={TD}>
                          <BulkCell
                            label={`${column.label} for ${variant.title}`}
                            error={error}
                            value={cell.value}
                            changed={cell.value !== was}
                            numeric={Boolean(column.numeric)}
                            disabled={edit.isSaving}
                            maxLength={
                              column.id === 'sku'
                                ? LIMITS.sku
                                : column.id === 'barcode'
                                  ? LIMITS.barcode
                                  : 20
                            }
                            onChange={(next) => setCell(index, column.id, next)}
                          />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {edit.confirming && (
        <ConfirmUpdateDialog
          title={`Update ${plural(changedCount || rows.length, 'variant')} of “${product.title}”?`}
          onConfirm={() => void edit.confirmSave()}
          onCancel={edit.cancelConfirm}
        />
      )}
      {cancelling && (
        <ConfirmCancelDialog
          lose={`your unsaved changes to ${plural(changedCount, 'variant')}`}
          onConfirm={() => {
            setCancelling(false)
            edit.discard()
            onClose()
          }}
          onKeep={() => setCancelling(false)}
        />
      )}
    </section>
  )
}
