import { useId, useState } from 'react'
import {
  CalendarIcon,
  PlayIcon,
  RefreshIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import {
  PRODUCT_SYNC_DAYS_DEFAULT,
  PRODUCT_SYNC_DAYS_MAX,
  PRODUCT_SYNC_DAYS_MIN,
} from '../../../lib/api/endpoints.ts'

/** The number of days is typed in a box that takes at most this many characters (365). */
const DAYS_MAX_LENGTH = 3

/** Why a typed number of days can't be sent, or null when it can. */
function daysProblem(text: string): string | null {
  const days = text.trim()
  if (!days) return 'Enter the number of days, or use Sync all products.'
  if (!/^\d+$/.test(days)) return 'Whole days only, e.g. 5.'
  const value = Number(days)
  if (value < PRODUCT_SYNC_DAYS_MIN || value > PRODUCT_SYNC_DAYS_MAX) {
    return `Between ${PRODUCT_SYNC_DAYS_MIN} and ${PRODUCT_SYNC_DAYS_MAX} days.`
  }
  return null
}

const BUTTON =
  'inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 text-[0.8rem] font-bold transition-colors disabled:pointer-events-none disabled:opacity-60'

/**
 * What "Sync products" drops down: a card under the button. A light green header — a sync icon
 * tile, "Changed Products · Last Days" and a ✕ that closes it — then a box for the number of days
 * (whole days, 1–365, 5 to begin with, with small up / down arrows) beside **Execute** (Enter
 * works too): every product changed in Shopify in that time is added to the CRM when new and
 * updated otherwise (`POST /sync/products?days=N`). Under the box, "Whole days, 1–365" and how
 * many of the 3 characters are used. Below a line, **Sync all products** — a full import (no
 * `days`) of the stores in play. Either starts the background sync and closes the card; a number
 * of days that can't be sent is explained under the box and nothing is sent.
 */
export function SyncProductsPanel({
  canSync,
  onSync,
  onClose,
}: {
  canSync: boolean
  /** `days` = the last days to bring in, or `null` for every product. */
  onSync: (days: number | null) => void
  onClose: () => void
}) {
  const id = useId()
  const [days, setDays] = useState(String(PRODUCT_SYNC_DAYS_DEFAULT))
  const [problem, setProblem] = useState<string | null>(null)

  function execute() {
    const wrong = daysProblem(days)
    setProblem(wrong)
    if (wrong || !canSync) return
    onSync(Number(days.trim()))
    onClose()
  }

  return (
    <div
      role="group"
      aria-label="Sync products"
      className="border-border bg-bg absolute top-full right-0 z-30 mt-1.5 flex w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border shadow-lg"
    >
      <div className="bg-accent-tint/60 flex items-center gap-2.5 px-3 py-2">
        <span
          aria-hidden="true"
          className="bg-accent-tint text-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        >
          <RefreshIcon width={16} height={16} />
        </span>
        <h3 className="m-0 min-w-0 flex-1 text-[0.86rem] leading-tight font-bold">
          Changed Products · Last Days
        </h3>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="border-border bg-bg text-text hover:text-accent flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border p-0 transition-colors"
        >
          <XIcon width={14} height={14} />
        </button>
      </div>

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          execute()
        }}
        className="flex flex-col gap-1.5 px-3 pt-3 pb-2.5"
      >
        <label htmlFor={`${id}-days`} className="text-[0.76rem] font-bold">
          Changed Products (Last Days)
        </label>
        <div className="flex items-center gap-2">
          <input
            id={`${id}-days`}
            type="number"
            autoFocus
            inputMode="numeric"
            autoComplete="off"
            min={PRODUCT_SYNC_DAYS_MIN}
            max={PRODUCT_SYNC_DAYS_MAX}
            placeholder="e.g. 5"
            value={days}
            aria-invalid={problem ? true : undefined}
            onChange={(event) => {
              // Digits only, at most 3 of them.
              setDays(event.target.value.replace(/\D/g, '').slice(0, DAYS_MAX_LENGTH))
              setProblem(null)
            }}
            className="border-accent bg-bg text-text placeholder:text-text-muted aria-[invalid=true]:border-danger h-9 min-w-0 flex-1 rounded-lg border-2 px-2.5 text-[0.84rem] outline-none"
          />
          <button
            type="submit"
            disabled={!canSync}
            className={`${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-transparent`}
          >
            <PlayIcon width={13} height={13} />
            Execute
          </button>
        </div>
        <div className="text-text-muted flex items-center justify-between text-[0.7rem]">
          <span className="flex items-center gap-1.5">
            <CalendarIcon width={13} height={13} />
            Whole days, {PRODUCT_SYNC_DAYS_MIN}–{PRODUCT_SYNC_DAYS_MAX}
          </span>
          <span aria-live="polite">
            {days.length} / {DAYS_MAX_LENGTH}
          </span>
        </div>
        {problem && (
          <p role="alert" className="text-danger m-0 text-[0.74rem]">
            {problem}
          </p>
        )}
      </form>

      <div className="border-border mx-3 border-t" />

      <div className="px-3 pt-2.5 pb-3">
        <button
          type="button"
          disabled={!canSync}
          onClick={() => {
            onSync(null)
            onClose()
          }}
          className={`${BUTTON} border-border-strong bg-accent-tint/60 text-accent hover:border-accent hover:bg-accent-tint w-full`}
        >
          <RefreshIcon width={14} height={14} />
          Sync all products
        </button>
      </div>
    </div>
  )
}
