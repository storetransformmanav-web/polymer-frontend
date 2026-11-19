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
import { useStockOptions } from '../hooks/useStockOptions.ts'
import { useStockWrites } from '../hooks/useStockWrites.ts'
import { fullName } from '../utils/format.ts'

const WIDTH = 416
const GAP = 6
const EDGE = 8

const CONTROL =
  'border-border bg-bg text-text focus:border-accent focus:outline-accent-tint h-9 min-w-0 rounded-lg border px-2.5 text-[0.82rem] font-medium outline-none focus:outline-2'

type Mode = 'set' | 'adjust'
type Item = Pick<InventoryItem, 'variant_id' | 'title' | 'variant_title' | 'locations'>

/**
 * A small pencil beside Available or On hand in the stock list. It opens a small box under it —
 * **Set to / Adjust by**, a number (with up / down arrows), a ✓, and a notes button that opens
 * the Reason and a Note — so a quantity can be changed without leaving the list. A Location box
 * shows only when the variant can be at more than one location, and a Quantity box only when
 * the backend listed quantities (`useStockOptions`); the Reason box only when it listed reasons
 * (the first is the default). Nothing is written in the app: those lists are the backend's.
 * **Adjust by** changes the one quantity by an amount (`POST /inventory/{variant}/adjust`); a move
 * between states waits for the backend's own call. ✓ sends it (the numbers on the page change at
 * once and the notice follows the change to Shopify); a refusal is shown in the box, which stays open.
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
  const stock = useStockOptions()
  const writes = useStockWrites()
  const [mode, setMode] = useState<Mode>('set')
  const [text, setText] = useState('')
  const [location, setLocation] = useState(
    String(item.locations[0]?.location_id ?? choices[0]?.id ?? ''),
  )
  const [quantity, setQuantity] = useState<EditableStockQuantity>(name)
  const [chosenReason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [notesOpen, setNotesOpen] = useState(false)
  const [touched, setTouched] = useState(false)
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  // Placed under the pencil (above it when there is no room), kept inside the window.
  const [place] = useState(() => {
    const box = anchor.current?.getBoundingClientRect()
    if (!box) return null
    const left = Math.min(
      Math.max(box.right - WIDTH, EDGE),
      Math.max(window.innerWidth - WIDTH - EDGE, EDGE),
    )
    const above = window.innerHeight - box.bottom < 300 && box.top > 300
    return above
      ? { left, top: undefined, bottom: window.innerHeight - box.top + GAP }
      : { left, top: box.bottom + GAP, bottom: undefined }
  })

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

  const reason = chosenReason || stock.reasons[0]?.value || ''
  const where = choices.find((choice) => String(choice.id) === location)
  const line = item.locations.find(
    (candidate) => String(candidate.location_id) === location,
  )
  const current = quantityOf(line, quantity)
  const problem = mode === 'set' ? validateSet(text) : validateDelta(text, current)
  const noteTooLong = note.length > MAX_NOTE
  const next =
    problem === null ? (mode === 'set' ? Number(text) : current + Number(text)) : null

  async function save() {
    setTouched(true)
    if (problem !== null || noteTooLong || !where || next === null) return
    const extra = {
      ...(reason ? { reason } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    }
    const request: StockRequest =
      mode === 'set'
        ? {
            mode: 'set',
            body: { location_id: where.id, quantities: { [quantity]: next }, ...extra },
          }
        : {
            mode: 'adjust',
            body: {
              location_id: where.id,
              name: quantity,
              delta: Number(text),
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

  if (!place) return null
  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-label={`Edit ${quantityLabel(quantity).toLowerCase()} of ${fullName(item)}`}
      style={{
        left: place.left,
        top: place.top,
        bottom: place.bottom,
        width: WIDTH,
        maxWidth: `calc(100vw - ${EDGE * 2}px)`,
      }}
      className="border-border bg-bg text-text fixed z-[100] flex flex-col gap-2.5 rounded-xl border p-3 text-left shadow-lg"
    >
      <div className="flex items-center gap-2">
        <select
          aria-label="How to change the stock"
          value={mode}
          onChange={(event) => {
            setMode(event.target.value as Mode)
            setText('')
            setTouched(false)
          }}
          className={`${CONTROL} bg-surface w-28 shrink-0 cursor-pointer font-semibold`}
        >
          <option value="set">Set to</option>
          <option value="adjust">Adjust by</option>
        </select>
        <input
          type="number"
          step={1}
          min={mode === 'set' ? 0 : undefined}
          autoFocus
          autoComplete="off"
          aria-label={mode === 'set' ? 'New quantity' : 'Amount to add or remove'}
          value={text}
          placeholder={mode === 'set' ? '0' : '+0'}
          aria-invalid={touched && problem ? true : undefined}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void save()
            }
          }}
          className={`${CONTROL} aria-[invalid=true]:border-danger flex-1 tabular-nums`}
        />
        <button
          type="button"
          aria-label="Reason and note"
          aria-expanded={notesOpen}
          aria-controls={`${id}-notes`}
          title="Reason and note"
          onClick={() => setNotesOpen((value) => !value)}
          className={`border-border flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-colors ${
            notesOpen || note.trim() || chosenReason
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

      {(choices.length > 1 || stock.quantities.length > 0) && (
        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
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
          {stock.quantities.length > 0 && (
            <select
              aria-label="Quantity"
              value={quantity}
              onChange={(event) =>
                setQuantity(event.target.value as EditableStockQuantity)
              }
              className={`${CONTROL} cursor-pointer`}
            >
              {stock.quantities.map((choice) => (
                <option key={choice.name} value={choice.name}>
                  {choice.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <p className="text-text-muted m-0 flex flex-wrap items-baseline gap-x-2 text-[0.76rem]">
        <span>
          {quantityLabel(quantity)}
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
      {touched && problem && (
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
              {stock.reasons.map((choice) => (
                <option key={choice.value} value={choice.value}>
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
