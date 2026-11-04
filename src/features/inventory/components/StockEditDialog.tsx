import { useState } from 'react'
import { Dialog } from '../../../components/ui/Dialog.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { SpinnerIcon } from '../../../components/ui/icons.tsx'
import { SelectField, type SelectOption } from '../../../components/ui/SelectField.tsx'
import {
  EDITABLE_STOCK_QUANTITIES,
  STOCK_REASONS,
  type EditableStockQuantity,
  type InventoryItem,
  type StockReason,
} from '../../../lib/api/endpoints.ts'
import {
  MAX_NOTE,
  QUANTITY_HINTS,
  QUANTITY_LABELS,
  REASON_LABELS,
  formatDelta,
  formatQuantity,
  quantityOf,
  setQuantity,
  validateDelta,
  validateSet,
} from '../../../lib/inventoryStock.ts'
import type { StockRequest } from '../../../app/store/inventorySlice.ts'
import { useLocationChoices } from '../hooks/useLocationChoices.ts'
import { useStockWrites } from '../hooks/useStockWrites.ts'
import { fullName } from '../utils/format.ts'

const BUTTON =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'
const MODE =
  'cursor-pointer rounded-md border px-3.5 py-1.5 text-[0.82rem] font-semibold transition-colors'

const QUANTITY_OPTIONS: SelectOption[] = EDITABLE_STOCK_QUANTITIES.map((name) => ({
  value: name,
  label: `${QUANTITY_LABELS[name]} — ${QUANTITY_HINTS[name]}`,
}))
const REASON_OPTIONS: SelectOption[] = STOCK_REASONS.map((reason) => ({
  value: reason,
  label: REASON_LABELS[reason],
}))

type Mode = 'set' | 'adjust'

/**
 * **Edit stock** — "Set to" (type the new number) or "Adjust by" (add or remove an amount) for
 * one variant at one location. Location (the row you clicked, to begin with), Quantity (the
 * editable names), the number, a Reason (default Correction) and an optional Note (500
 * characters). A live preview shows **before → after** from the numbers on the page. **Save
 * stock** sends it: the page shows the new numbers at once and the notice follows the change
 * to Shopify ("Sending to Shopify…", then "Confirmed"). A refusal is shown here and the window
 * stays open.
 */
export function StockEditDialog({
  variant,
  locationId,
  mode: initialMode = 'set',
  quantity: initialQuantity = 'available',
  onClose,
}: {
  variant: Pick<InventoryItem, 'variant_id' | 'title' | 'variant_title' | 'locations'>
  /** The row that was clicked: the location the window starts on. */
  locationId?: number
  mode?: Mode
  quantity?: EditableStockQuantity
  onClose: () => void
}) {
  const choices = useLocationChoices(variant)
  const writes = useStockWrites()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [location, setLocation] = useState<string>(
    String(locationId ?? variant.locations[0]?.location_id ?? choices[0]?.id ?? ''),
  )
  const [quantity, setQuantityName] = useState<EditableStockQuantity>(initialQuantity)
  const [text, setText] = useState('')
  const [reason, setReason] = useState<StockReason>('correction')
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const place = choices.find((choice) => String(choice.id) === location)
  const line = variant.locations.find(
    (candidate) => String(candidate.location_id) === location,
  )
  const current = quantityOf(line, quantity)
  const problem = mode === 'set' ? validateSet(text) : validateDelta(text, current)
  const noteTooLong = note.length > MAX_NOTE

  // The preview: the quantity, and what moving it does to the others (on hand follows available).
  const next =
    problem === null ? (mode === 'set' ? Number(text) : current + Number(text)) : null
  const after = next === null ? null : setQuantity({ ...line }, quantity, next)
  const shown = (['available', 'on_hand', 'unavailable'] as const).filter(
    (name) =>
      name === quantity ||
      (after !== null && quantityOf(after, name) !== quantityOf(line, name)),
  )

  async function save() {
    setTouched(true)
    if (problem !== null || noteTooLong || !place || next === null) return
    const request: StockRequest =
      mode === 'set'
        ? {
            mode: 'set',
            body: {
              location_id: place.id,
              quantities: { [quantity]: next },
              reason,
              ...(note.trim() ? { note: note.trim() } : {}),
            },
          }
        : {
            mode: 'adjust',
            body: {
              location_id: place.id,
              name: quantity,
              delta: Number(text),
              reason,
              ...(note.trim() ? { note: note.trim() } : {}),
            },
          }
    setSending(true)
    setFailure(null)
    const outcome = await writes.save({
      ref: variant.variant_id,
      request,
      label: `${QUANTITY_LABELS[quantity]} at ${place.name}: ${formatQuantity(current)} → ${formatQuantity(next)}`,
    })
    setSending(false)
    if (outcome.ok) onClose()
    else setFailure(outcome.error)
  }

  return (
    <Dialog
      title={`Edit stock – ${fullName(variant)}`}
      role="dialog"
      wide
      closeButton
      closeDisabled={sending}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className={`${BUTTON} border-border bg-bg text-text hover:border-accent`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={sending || !place}
            className={`${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent`}
          >
            {sending && <SpinnerIcon width={14} height={14} className="animate-spin" />}
            Save stock
          </button>
        </>
      }
    >
      <div className="text-text flex flex-col gap-3.5">
        <div
          role="group"
          aria-label="How to change the stock"
          className="border-border bg-surface inline-flex gap-1 self-start rounded-lg border p-1"
        >
          {(
            [
              ['set', 'Set to'],
              ['adjust', 'Adjust by'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value)
                setText('')
                setTouched(false)
              }}
              className={`${MODE} ${
                mode === value
                  ? 'border-accent bg-bg text-text shadow-sm'
                  : 'text-text-muted hover:text-text border-transparent bg-transparent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2">
          <SelectField
            id="stock-location"
            label="Location"
            value={location}
            options={choices.map((choice) => ({
              value: String(choice.id),
              label: choice.name,
            }))}
            onChange={setLocation}
          />
          <SelectField
            id="stock-quantity"
            label="Quantity"
            value={quantity}
            options={QUANTITY_OPTIONS}
            onChange={(value) => setQuantityName(value as EditableStockQuantity)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="stock-number"
            className="text-text text-[0.82rem] font-semibold"
          >
            {mode === 'set' ? 'New quantity' : 'Amount to add or remove'}
          </label>
          <input
            id="stock-number"
            inputMode={mode === 'set' ? 'numeric' : 'text'}
            autoComplete="off"
            autoFocus
            value={text}
            placeholder={mode === 'set' ? 'e.g. 22' : 'e.g. 12, or -3 to remove'}
            aria-invalid={touched && problem ? true : undefined}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void save()
              }
            }}
            className="border-border bg-bg text-text focus:border-accent focus:outline-accent-tint aria-[invalid=true]:border-danger h-10 w-full rounded-lg border px-3 text-[0.9rem] font-medium outline-none focus:outline-2"
          />
          {touched && problem && (
            <p role="alert" className="text-danger m-0 text-[0.78rem]">
              {problem}
            </p>
          )}
        </div>

        {/* Before → after, from the numbers on the page. */}
        <div
          aria-label="Preview"
          role="group"
          className="border-border-strong bg-accent-tint/30 flex flex-col gap-1.5 rounded-lg border px-3.5 py-3"
        >
          <p className="text-text-muted m-0 text-[0.68rem] font-bold tracking-wide uppercase">
            Preview{place ? ` · ${place.name}` : ''}
          </p>
          {shown.map((name) => {
            const before = quantityOf(line, name)
            const result = after === null ? null : quantityOf(after, name)
            return (
              <p
                key={name}
                className="m-0 flex flex-wrap items-baseline gap-x-2 text-[0.9rem]"
              >
                <span className="text-text-muted w-32 shrink-0">
                  {QUANTITY_LABELS[name]}
                </span>
                <span className="text-text-muted">{formatQuantity(before)}</span>
                <span aria-hidden="true" className="text-accent font-bold">
                  →
                </span>
                <strong>{result === null ? '—' : formatQuantity(result)}</strong>
                {result !== null && result !== before && (
                  <span className="text-text-muted text-[0.78rem]">
                    ({formatDelta(result - before)})
                  </span>
                )}
              </p>
            )
          })}
          {!line && (
            <p className="text-text-muted m-0 text-[0.76rem]">
              No stock is recorded at this location yet — saving sets it up in Shopify.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2">
          <SelectField
            id="stock-reason"
            label="Reason"
            value={reason}
            options={REASON_OPTIONS}
            onChange={(value) => setReason(value as StockReason)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <label
              htmlFor="stock-note"
              className="text-text text-[0.82rem] font-semibold"
            >
              Note <span className="text-text-muted font-normal">(optional)</span>
            </label>
            <span
              className={`text-[0.72rem] tabular-nums ${noteTooLong ? 'text-danger font-semibold' : 'text-text-muted'}`}
            >
              {note.length} / {MAX_NOTE}
            </span>
          </div>
          <textarea
            id="stock-note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Stock count 3 Nov, delivery PO-1041…"
            className="border-border bg-bg text-text focus:border-accent focus:outline-accent-tint min-h-16 w-full resize-y rounded-lg border px-3 py-2 text-[0.88rem] outline-none focus:outline-2"
          />
          {noteTooLong && (
            <p role="alert" className="text-danger m-0 text-[0.78rem]">
              The note can have at most {MAX_NOTE} characters.
            </p>
          )}
        </div>

        <p className="text-text-muted m-0 text-[0.78rem]">
          These changes will also be updated in Shopify.
        </p>
        {failure && <FormMessage tone="error">{failure}</FormMessage>}
      </div>
    </Dialog>
  )
}
