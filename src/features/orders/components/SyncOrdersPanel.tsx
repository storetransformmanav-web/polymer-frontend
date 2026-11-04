import { useId, useState } from 'react'
import { RefreshIcon } from '../../../components/ui/icons.tsx'
import {
  ORDER_SYNC_DAYS_DEFAULT,
  ORDER_SYNC_DAYS_MAX,
  ORDER_SYNC_DAYS_MIN,
} from '../../../lib/api/endpoints.ts'
import type { OrdersSyncRequest } from '../hooks/useOrdersSync.ts'

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

/** Quick choices for a refresh: a week, a month, three months. */
const QUICK_DAYS = [7, 30, 90]

const HEADING = 'text-text-muted text-[0.68rem] font-bold tracking-wide uppercase'
const SMALL_BUTTON =
  'inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none px-3 text-[0.8rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60'

/**
 * What "Sync orders" drops down: a small panel under the button with the API's two modes.
 * **New and changed orders** (`mode=new`, the API's default) brings in everything created or
 * changed in Shopify since the newest order in the CRM. Below a line, **Refresh the last N
 * days** (`mode=refresh&days=N`, 1–3650, 10 to begin with) re-reads every order created in
 * that time and updates the ones already there. Either one starts the background import and
 * closes the panel; a number of days that can't be sent is explained and nothing is sent.
 */
export function SyncOrdersPanel({
  targets,
  canSync,
  onSync,
  onClose,
}: {
  /** The stores in play: the one picked in the top bar, or every connected one. */
  targets: { key: string; label: string }[]
  canSync: boolean
  onSync: (request: OrdersSyncRequest) => void
  onClose: () => void
}) {
  const id = useId()
  const [days, setDays] = useState(String(ORDER_SYNC_DAYS_DEFAULT))
  const [problem, setProblem] = useState<string | null>(null)
  const names = targets.map((target) => target.label).join(', ') || 'the store'

  function refresh(text: string) {
    const wrong = daysProblem(text)
    setProblem(wrong)
    if (wrong || !canSync) return
    onSync({ mode: 'refresh', days: Number(text.trim()) })
    onClose()
  }

  return (
    <div
      role="group"
      aria-label="Sync orders"
      className="border-border bg-bg absolute top-full right-0 z-30 mt-1.5 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2.5 rounded-xl border p-3 shadow-lg"
    >
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          autoFocus
          disabled={!canSync}
          onClick={() => {
            onSync({ mode: 'new' })
            onClose()
          }}
          className={`${SMALL_BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover w-full`}
        >
          <RefreshIcon width={14} height={14} />
          Sync new and changed orders
        </button>
        <span className="text-text-muted text-center text-[0.7rem]">
          Everything created or changed in Shopify since the newest order here, for{' '}
          {names}.
        </span>
      </div>

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          refresh(days)
        }}
        className="border-border flex flex-col gap-2 border-t pt-2.5"
      >
        <label htmlFor={`${id}-days`} className={HEADING}>
          Refresh the last days
        </label>
        <div className="flex items-center gap-2">
          <input
            id={`${id}-days`}
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
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
            className={`${SMALL_BUTTON} border-border bg-bg text-text hover:border-accent hover:text-accent hover:bg-accent-tint border border-solid`}
          >
            Refresh
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {QUICK_DAYS.map((quick) => (
            <button
              key={quick}
              type="button"
              aria-pressed={days.trim() === String(quick)}
              onClick={() => {
                setDays(String(quick))
                setProblem(null)
              }}
              className="border-border bg-bg text-text hover:border-accent aria-pressed:border-accent aria-pressed:bg-accent-tint aria-pressed:text-accent h-7 cursor-pointer rounded-full border px-2.5 text-[0.72rem] font-semibold transition-colors"
            >
              {quick} days
            </button>
          ))}
        </div>
        {problem && (
          <p role="alert" className="text-danger m-0 text-[0.76rem]">
            {problem}
          </p>
        )}
        <span className="text-text-muted text-[0.7rem]">
          Re-reads every order created in that time and updates the ones already here.
        </span>
      </form>
    </div>
  )
}
