import { useId, useState } from 'react'
import { RefreshIcon } from '../../../components/ui/icons.tsx'
import {
  ORDER_SYNC_DAYS_DEFAULT,
  ORDER_SYNC_DAYS_MAX,
  ORDER_SYNC_DAYS_MIN,
} from '../../../lib/api/endpoints.ts'
import type { OrdersSyncRequest } from '../hooks/useOrdersSync.ts'

/** The number of days is typed in a box that takes at most this many characters (3650). */
const DAYS_MAX_LENGTH = 4

/** Why a typed number of days can't be sent, or null when it can. */
function daysProblem(text: string): string | null {
  const days = text.trim()
  if (!days) return 'Enter the number of days.'
  if (!/^\d+$/.test(days)) return 'Whole days only, e.g. 90.'
  const value = Number(days)
  if (value < ORDER_SYNC_DAYS_MIN || value > ORDER_SYNC_DAYS_MAX) {
    return `Between ${ORDER_SYNC_DAYS_MIN} and ${ORDER_SYNC_DAYS_MAX} days.`
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
 * What "Sync orders" drops down: a small panel under the button, laid out like the products one.
 * On top, **a refresh of the last days** (`mode=refresh&days=N`) — a box for the number of days
 * (whole days, 1–3650, 10 to begin with) with a **Refresh** button beside it (Enter works too);
 * it re-reads every order created in that time and updates the ones already here. Below a line,
 * **Sync new and changed orders** (`mode=new`, the API's default) — everything created or
 * changed in Shopify since the newest order here — for the stores in play. Either one starts
 * the background import and closes the panel; a number of days that can't be sent is explained
 * under the box and nothing is sent.
 */
export function SyncOrdersPanel({
  targets,
  canSync,
  onSync,
  onClose,
}: {
  /** The stores in play: the one picked in the top bar, or every connected one. */
  targets: SyncTarget[]
  canSync: boolean
  onSync: (request: OrdersSyncRequest) => void
  onClose: () => void
}) {
  const id = useId()
  const [days, setDays] = useState(String(ORDER_SYNC_DAYS_DEFAULT))
  const [problem, setProblem] = useState<string | null>(null)
  const names = targets.map((target) => target.label).join(', ')

  function refresh() {
    const wrong = daysProblem(days)
    setProblem(wrong)
    if (wrong || !canSync) return
    onSync({ mode: 'refresh', days: Number(days.trim()) })
    onClose()
  }

  return (
    <div
      role="group"
      aria-label="Sync orders"
      className="border-border bg-bg absolute top-full right-0 z-30 mt-1.5 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2.5 rounded-xl border p-3 shadow-lg"
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          refresh()
        }}
        className="flex flex-col gap-2"
      >
        <label htmlFor={`${id}-days`} className={HEADING}>
          Refresh orders · Last days
        </label>
        <div className="flex items-center gap-2">
          <input
            id={`${id}-days`}
            autoFocus
            inputMode="numeric"
            autoComplete="off"
            placeholder="e.g. 90"
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
            Refresh
          </button>
        </div>

        <span className="text-text-muted flex justify-between text-[0.7rem]">
          <span>
            Whole days, {ORDER_SYNC_DAYS_MIN}–{ORDER_SYNC_DAYS_MAX}
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
            onSync({ mode: 'new' })
            onClose()
          }}
          className={`${SMALL_BUTTON} border-border bg-bg text-text hover:border-accent hover:text-accent hover:bg-accent-tint w-full border border-solid`}
        >
          <RefreshIcon width={14} height={14} />
          Sync new and changed orders
        </button>
        <span className="text-text-muted text-center text-[0.7rem]">
          Everything new or changed in {names || 'the store'}, in the background.
        </span>
      </div>
    </div>
  )
}
