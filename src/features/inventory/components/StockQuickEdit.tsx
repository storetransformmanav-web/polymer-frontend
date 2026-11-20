import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import {
  CheckIcon,
  NotePlusIcon,
  PencilIcon,
  SpinnerIcon,
} from '../../../components/ui/icons.tsx'
import type { EditableStockQuantity, InventoryItem } from '../../../lib/api/endpoints.ts'
import {
  MAX_NOTE,
  formatDelta,
  formatQuantity,
  quantityLabel,
  quantityOf,
  validateDelta,
  validateSet,
} from '../../../lib/inventoryStock.ts'
import type { StockRequest } from '../../../app/store/inventorySlice.ts'
import { useLocationChoices } from '../hooks/useLocationChoices.ts'
import {
  useStockOptions,
  type ModeChoice,
  type QuantityChoice,
} from '../hooks/useStockOptions.ts'
import { useStockWrites } from '../hooks/useStockWrites.ts'
import { fullName } from '../utils/format.ts'

/** "Set to" is a short box; "Adjust by" holds two more dropdowns (from → to), so it is wider. */
const WIDTH_SET = 460
const WIDTH_ADJUST = 640
const GAP = 6
const EDGE = 8

const CONTROL =
  'border-border bg-bg text-text focus:border-accent focus:outline-accent-tint h-9 min-w-0 rounded-lg border px-2.5 text-[0.82rem] font-medium outline-none focus:outline-2'

type Mode = 'set' | 'adjust'
type Item = Pick<InventoryItem, 'variant_id' | 'title' | 'variant_title' | 'locations'>

/** The two ends of an "Adjust by" that are not a quantity: stock arriving, and stock leaving. */
const ADDITION = '@addition'
const REMOVAL = '@removal'
const ADDITION_LABEL = 'Inventory addition'
const REMOVAL_LABEL = 'Inventory removal'

/** The words of the two modes when the backend's list has not arrived (it names them itself). */
const DEFAULT_MODES: ModeChoice[] = [
  { value: 'set', label: 'Set to' },
  { value: 'adjust', label: 'Adjust by' },
]

/**
 * A small pencil beside Available or On hand in the stock list. It opens a small box under it:
 *  - **Set to** (the mode it opens on) — a number (with up / down arrows) and the quantity it sets, then
 *    the **reason and note** button and ✓;
 *  - **Adjust by** — a number, the **from** and **to** of the change (**Inventory addition** → a quantity
 *    adds to it, a quantity → **Inventory removal** takes from it) — then the reason and note button and ✓.
 * The quantities, the reasons and the mode names are the backend's (`GET /inventory/reasons`,
 * `useStockOptions`): both modes list every editable quantity (a quantity "Set to" cannot take directly is
 * set by adjusting it by the difference), and the button opens the **Add reason** dropdown — **every**
 * reason the backend has (Correction, Count, Received…), none chosen to begin with, so one is sent only
 * when picked — and a Note. A Location box shows only when the variant can be at more
 * than one location. Moving stock from one quantity to another needs a call the backend does not have
 * yet, so that choice is explained and not sent. ✓ sends one `PUT /inventory/{variant}` (Set to) or
 * `POST /inventory/{variant}/adjust` (Adjust by): the numbers on the page change at once and the notice
 * follows the change to Shopify; a refusal is shown in the box, which stays open.
 */
export function StockQuickEdit({
  item,
  name,
}: {
  item: Item
  name: 'available' | 'on_hand'
}) {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const label = `Edit ${quantityLabel(name).toLowerCase()} of ${fullName(item)}`

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        title={`Edit ${quantityLabel(name).toLowerCase()}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="text-text-muted hover:text-accent hover:bg-accent-tint/60 inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent p-0 transition-colors"
      >
        <PencilIcon width={12} height={12} />
      </button>
      {open && (
        <QuickEditPanel
          item={item}
          name={name}
          anchor={button}
          onClose={() => {
            setOpen(false)
            button.current?.focus()
          }}
        />
      )}
    </>
  )
}

/** Where the box goes: under the pencil (above it when there is no room), kept inside the window. */
function placeOf(box: DOMRect, width: number) {
  const left = Math.min(
    Math.max(box.right - width, EDGE),
    Math.max(window.innerWidth - width - EDGE, EDGE),
  )
  const above = window.innerHeight - box.bottom < 300 && box.top > 300
  return above
    ? { left, top: undefined, bottom: window.innerHeight - box.top + GAP }
    : { left, top: box.bottom + GAP, bottom: undefined }
}

function QuickEditPanel({
  item,
  name,
  anchor,
  onClose,
}: {
  item: Item
  name: 'available' | 'on_hand'
  anchor: RefObject<HTMLButtonElement | null>
  onClose: () => void
}) {
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  const choices = useLocationChoices(item)
  const stock = useStockOptions({ fresh: true })
  const writes = useStockWrites()
  const [mode, setMode] = useState<Mode>('set')
  const [text, setText] = useState('')
  const [location, setLocation] = useState(
    String(item.locations[0]?.location_id ?? choices[0]?.id ?? ''),
  )
  // "Set to": the quantity it sets. "Adjust by": the two ends of the change.
  const [setName, setSetName] = useState<EditableStockQuantity>(name)
  const [from, setFrom] = useState<string>(ADDITION)
  const [to, setTo] = useState<string>(name)
  const [chosenReason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [notesOpen, setNotesOpen] = useState(false)
  const [touched, setTouched] = useState(false)
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [box] = useState(() => anchor.current?.getBoundingClientRect() ?? null)
  const width = mode === 'adjust' ? WIDTH_ADJUST : WIDTH_SET
  const place = box ? placeOf(box, width) : null

  // Closes on Escape, a click outside, scrolling the page or resizing.
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (panel.current?.contains(target) || anchor.current?.contains(target)) return
      onClose()
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    function onScroll(event: Event) {
      if (panel.current?.contains(event.target as Node)) return
      onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onClose)
    }
  }, [anchor, onClose])

  // The quantities: the backend's list, or — when it has sent none — just the one the pencil is for.
  const allQuantities: QuantityChoice[] =
    stock.quantities.length > 0
      ? stock.quantities
      : [{ name, label: quantityLabel(name), setSupported: true }]
  // "Set to" lists every editable quantity. One the backend cannot set directly (`set_supported: false`:
  // Damaged, Quality control…) is set by adjusting it by the difference — see `save`.
  const setChoices = allQuantities
  const quantityToSet = setChoices.some((choice) => choice.name === setName)
    ? setName
    : setChoices[0].name

  // "Adjust by": an addition adds to the quantity on the right; a removal takes from the one on the
  // left. Moving between two quantities needs a call the backend does not have yet.
  let target: EditableStockQuantity | null = null
  let sign = 0
  let adjustProblem: string | null = null
  if (from === ADDITION && to === REMOVAL) {
    adjustProblem = 'Choose the quantity to add to or take from.'
  } else if (from === ADDITION) {
    target = to as EditableStockQuantity
    sign = 1
  } else if (to === REMOVAL) {
    target = from as EditableStockQuantity
    sign = -1
  } else {
    adjustProblem = 'Moving stock from one quantity to another isn’t available yet.'
  }

  const quantity: EditableStockQuantity =
    mode === 'set' ? quantityToSet : (target ?? name)
  const where = choices.find((choice) => String(choice.id) === location)
  const line = item.locations.find(
    (candidate) => String(candidate.location_id) === location,
  )
  const current = quantityOf(line, quantity)

  // A quantity "Set to" cannot take directly is set with an adjustment of the difference.
  const settableDirectly =
    allQuantities.find((choice) => choice.name === quantity)?.setSupported ?? true
  const setByAdjusting = mode === 'set' && !settableDirectly

  let problem: string | null
  if (mode === 'set') {
    problem = validateSet(text)
    if (problem === null && setByAdjusting && Number(text) === current) {
      problem = 'It already has that number'
    }
  } else if (adjustProblem) problem = adjustProblem
  else if (text.trim() === '') problem = 'Enter an amount'
  else if (!/^\d+$/.test(text.trim())) problem = 'Enter a whole number above 0'
  else problem = validateDelta(String(sign * Number(text.trim())), current)

  const noteTooLong = note.length > MAX_NOTE
  const next =
    problem === null
      ? mode === 'set'
        ? Number(text)
        : current + sign * Number(text.trim())
      : null

  // The reason: every one the backend lists (behind the note button), "Add reason" (none) to begin
  // with — it is optional, and one is sent only when it was chosen.
  const reason = stock.reasons.some((choice) => choice.value === chosenReason)
    ? chosenReason
    : ''

  const modes = stock.modes.length > 0 ? stock.modes : DEFAULT_MODES
  const modeHelp = modes.find((choice) => choice.value === mode)?.help

  async function save() {
    setTouched(true)
    if (problem !== null || noteTooLong || !where || next === null) return
    const extra = {
      ...(reason ? { reason } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    }
    const request: StockRequest =
      mode === 'set' && !setByAdjusting
        ? {
            mode: 'set',
            body: { location_id: where.id, quantities: { [quantity]: next }, ...extra },
          }
        : {
            mode: 'adjust',
            body: {
              location_id: where.id,
              name: quantity,
              delta: setByAdjusting ? next - current : sign * Number(text.trim()),
              ...extra,
            },
          }
    setSending(true)
    setFailure(null)
    const outcome = await writes.save({
      ref: item.variant_id,
      request,
      label: `${quantityLabel(quantity)} at ${where.name}: ${formatQuantity(current)} → ${formatQuantity(next)}`,
    })
    setSending(false)
    if (outcome.ok) onClose()
    else setFailure(outcome.error)
  }

  const labelOf = (key: string) =>
    key === ADDITION
      ? ADDITION_LABEL
      : key === REMOVAL
        ? REMOVAL_LABEL
        : (allQuantities.find((choice) => choice.name === key)?.label ??
          quantityLabel(key))

  if (!place) return null
  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-label={`Edit ${quantityLabel(name).toLowerCase()} of ${fullName(item)}`}
      style={{
        left: place.left,
        top: place.top,
        bottom: place.bottom,
        width,
        maxWidth: `calc(100vw - ${EDGE * 2}px)`,
      }}
      className="border-border bg-bg text-text fixed z-[100] flex flex-col gap-2.5 rounded-xl border p-3 text-left shadow-lg"
    >
      <div className="flex items-center gap-2">
        <select
          aria-label="How to change the stock"
          title={modeHelp}
          value={mode}
          onChange={(event) => {
            setMode(event.target.value as Mode)
            setText('')
            setTouched(false)
          }}
          className={`${CONTROL} bg-surface w-28 shrink-0 cursor-pointer font-semibold`}
        >
          {modes.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          step={1}
          min={mode === 'set' ? 0 : 1}
          autoFocus
          autoComplete="off"
          aria-label={mode === 'set' ? 'New quantity' : 'Amount to add or remove'}
          value={text}
          placeholder="0"
          aria-invalid={touched && problem ? true : undefined}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void save()
            }
          }}
          className={`${CONTROL} aria-[invalid=true]:border-danger tabular-nums ${
            mode === 'adjust' ? 'w-20 shrink-0' : 'flex-1'
          }`}
        />

        {mode === 'set' ? (
          <select
            aria-label="Quantity"
            value={quantityToSet}
            onChange={(event) => setSetName(event.target.value as EditableStockQuantity)}
            className={`${CONTROL} w-40 shrink-0 cursor-pointer`}
          >
            {setChoices.map((choice) => (
              <option key={choice.name} value={choice.name} title={choice.description}>
                {choice.label}
              </option>
            ))}
          </select>
        ) : (
          <>
            <select
              aria-label="From"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className={`${CONTROL} min-w-0 flex-1 cursor-pointer`}
            >
              <option value={ADDITION}>{ADDITION_LABEL}</option>
              {allQuantities.map((choice) => (
                <option key={choice.name} value={choice.name} title={choice.description}>
                  {choice.label}
                </option>
              ))}
            </select>
            <span aria-hidden="true" className="text-text-muted shrink-0 text-[1rem]">
              →
            </span>
            <select
              aria-label="To"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className={`${CONTROL} min-w-0 flex-1 cursor-pointer`}
            >
              <option value={REMOVAL}>{REMOVAL_LABEL}</option>
              {allQuantities.map((choice) => (
                <option key={choice.name} value={choice.name} title={choice.description}>
                  {choice.label}
                </option>
              ))}
            </select>
          </>
        )}

        <button
          type="button"
          aria-label="Reason and note"
          aria-expanded={notesOpen}
          aria-controls={`${id}-notes`}
          title="Add a reason or a note"
          onClick={() => setNotesOpen((value) => !value)}
          className={`border-border flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-colors ${
            notesOpen || note.trim() || reason
              ? 'bg-accent-tint text-accent border-accent'
              : 'bg-bg text-text-muted hover:text-text'
          }`}
        >
          <NotePlusIcon width={16} height={16} />
        </button>
        <button
          type="button"
          aria-label="Save stock"
          title="Save"
          disabled={sending || !where}
          onClick={() => void save()}
          className="bg-accent text-accent-contrast hover:bg-accent-hover flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none transition-colors disabled:pointer-events-none disabled:opacity-50"
        >
          {sending ? (
            <SpinnerIcon width={14} height={14} className="animate-spin" />
          ) : (
            <CheckIcon width={16} height={16} />
          )}
        </button>
      </div>

      {choices.length > 1 && (
        <select
          aria-label="Location"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          className={`${CONTROL} cursor-pointer`}
        >
          {choices.map((choice) => (
            <option key={choice.id} value={String(choice.id)}>
              {choice.name}
            </option>
          ))}
        </select>
      )}

      <p className="text-text-muted m-0 flex flex-wrap items-baseline gap-x-2 text-[0.76rem]">
        <span>
          {labelOf(quantity)}
          {where ? ` · ${where.name}` : ''}
        </span>
        <span className="tabular-nums">{formatQuantity(current)}</span>
        <span aria-hidden="true" className="text-accent font-bold">
          →
        </span>
        <strong className="text-text tabular-nums">
          {next === null ? '—' : formatQuantity(next)}
        </strong>
        {next !== null && next !== current && (
          <span>({formatDelta(next - current)})</span>
        )}
      </p>
      {mode === 'adjust' && adjustProblem && (
        <p role="alert" className="text-text-muted m-0 text-[0.76rem]">
          {adjustProblem}
        </p>
      )}
      {touched && problem && !(mode === 'adjust' && adjustProblem) && (
        <p role="alert" className="text-danger m-0 text-[0.76rem]">
          {problem}
        </p>
      )}

      {notesOpen && (
        <div
          id={`${id}-notes`}
          className="border-border flex flex-col gap-2 border-t pt-2.5"
        >
          {stock.reasons.length > 0 && (
            <select
              aria-label="Reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={`${CONTROL} cursor-pointer`}
            >
              <option value="">Add reason</option>
              {stock.reasons.map((choice) => (
                <option
                  key={choice.value}
                  value={choice.value}
                  title={choice.description}
                >
                  {choice.label}
                </option>
              ))}
            </select>
          )}
          <textarea
            aria-label="Note (optional)"
            rows={2}
            value={note}
            placeholder="Note (optional)"
            onChange={(event) => setNote(event.target.value)}
            className="border-border bg-bg text-text focus:border-accent focus:outline-accent-tint min-h-14 w-full resize-y rounded-lg border px-2.5 py-1.5 text-[0.8rem] outline-none focus:outline-2"
          />
          <span
            className={`self-end text-[0.7rem] tabular-nums ${noteTooLong ? 'text-danger font-semibold' : 'text-text-muted'}`}
          >
            {note.length} / {MAX_NOTE}
          </span>
        </div>
      )}

      {failure && (
        <p role="alert" className="text-danger m-0 text-[0.78rem]">
          {failure}
        </p>
      )}
    </div>,
    document.body,
  )
}
