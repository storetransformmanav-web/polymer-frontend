import { useId, useState } from 'react'
import { RefreshIcon } from '../../../components/ui/icons.tsx'
import {
  CUSTOMER_SYNC_DAYS_DEFAULT,
  CUSTOMER_SYNC_DAYS_MAX,
  CUSTOMER_SYNC_DAYS_MIN,
} from '../../../lib/api/endpoints.ts'

/** The number of days is typed in a box that takes at most this many characters (365). */
const DAYS_MAX_LENGTH = 3

/** Why a typed number of days can't be sent, or null when it can. */
function daysProblem(text: string): string | null {
  const days = text.trim()
  if (!days) return 'Enter the number of days, or use Sync all customers.'
  if (!/^\d+$/.test(days)) return 'Whole days only, e.g. 5.'
  const value = Number(days)
  if (value < CUSTOMER_SYNC_DAYS_MIN || value > CUSTOMER_SYNC_DAYS_MAX) {
    return `Between ${CUSTOMER_SYNC_DAYS_MIN} and ${CUSTOMER_SYNC_DAYS_MAX} days.`
  }
  return null
}

interface SyncTarget {
  key: string
  label: string
}

const HEADING = 'text-text-muted text-[0.68rem] font-bold tracking-wide uppercase'
const SMALL_BUTTON =
  'inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none px-3 text-[0.8rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60'

/**
 * What "Sync customers" drops down: a small panel under the button, laid out exactly like the
 * products one. On top, **the last days** (`POST /sync/customers?days=N`) — a box for the number
 * of days (whole days, 1–365, 5 to begin with) with a **Sync** button beside it (Enter works
 * too); every customer changed in Shopify in that time (by updated date) is added when new and
 * updated otherwise. Below a line, **Sync all customers** — a full import (no `days`) of the
 * stores in play. Either one starts the background sync and closes the panel; a number of days
 * that can't be sent is explained under the box and nothing is sent.
 */
export function SyncCustomersPanel({
  targets,
  canSync,
  onSync,
  onClose,
}: {
  /** The stores in play: the one picked in the top bar, or every connected one. */
  targets: SyncTarget[]
  canSync: boolean
  /** `days` = the last days to bring in, or `null` for every customer. */
  onSync: (days: number | null) => void
  onClose: () => void
}) {
  const id = useId()
  const [days, setDays] = useState(String(CUSTOMER_SYNC_DAYS_DEFAULT))
  const [problem, setProblem] = useState<string | null>(null)
  const names = targets.map((target) => target.label).join(', ')

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
      aria-label="Sync customers"
      className="border-border bg-bg absolute top-full right-0 z-30 mt-1.5 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2.5 rounded-xl border p-3 shadow-lg"
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          execute()
        }}
        className="flex flex-col gap-2"
      >
        <label htmlFor={`${id}-days`} className={HEADING}>
          Changed customers · Last days
        </label>
        <div className="flex items-center gap-2">
          <input
            id={`${id}-days`}
            autoFocus
            inputMode="numeric"
            autoComplete="off"
            placeholder="e.g. 5"
            maxLength={DAYS_MAX_LENGTH}
            value={days}
            aria-invalid={problem ? true : undefined}
            onChange={(event) => {
              setDays(event.target.value)
              setProblem(null)
            }}
            className="border-border bg-bg text-text placeholder:text-text-muted focus:border-accent focus:outline-accent-tint aria-[invalid=true]:border-danger h-9 min-w-0 flex-1 rounded-lg border px-2.5 text-[0.84rem] outline-none focus:outline-2"
          />
          <button
            type="submit"
            disabled={!canSync}
            className={`${SMALL_BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover`}
          >
            Sync
          </button>
        </div>

        <span className="text-text-muted flex justify-between text-[0.7rem]">
          <span>
            Whole days, {CUSTOMER_SYNC_DAYS_MIN}–{CUSTOMER_SYNC_DAYS_MAX}
          </span>
          <span aria-live="polite">
            {days.length}/{DAYS_MAX_LENGTH}
          </span>
        </span>
        {problem && (
          <p role="alert" className="text-danger m-0 text-[0.76rem]">
            {problem}
          </p>
        )}
      </form>

      <div className="border-border flex flex-col gap-1.5 border-t pt-2.5">
        <button
          type="button"
          disabled={!canSync}
          onClick={() => {
            onSync(null)
            onClose()
          }}
          className={`${SMALL_BUTTON} border-border bg-bg text-text hover:border-accent hover:text-accent hover:bg-accent-tint w-full border border-solid`}
        >
          <RefreshIcon width={14} height={14} />
          Sync all customers
        </button>
        <span className="text-text-muted text-center text-[0.7rem]">
          A full import of every customer of {names || 'the store'}, in the background.
        </span>
      </div>
    </div>
  )
}
