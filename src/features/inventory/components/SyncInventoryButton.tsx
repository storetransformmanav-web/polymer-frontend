import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  RefreshIcon,
  SpinnerIcon,
} from '../../../components/ui/icons.tsx'
import { useInventorySync } from '../hooks/useInventorySync.ts'

const count = (value: number) => value.toLocaleString('en-GB')

const SMALL_BUTTON =
  'inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 text-[0.8rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60'

/**
 * "Sync inventory" in the top bar, laid out like the Sync products and Sync collections buttons: a
 * click drops down a small panel with one choice — **Sync inventory now** (`dry_run=false`: saves
 * Shopify's stock in the CRM; nothing is ever changed in Shopify). The backend answers when it has
 * finished, so the button shows "Syncing…" meanwhile and then the result beside it — the backend's own
 * message (the hover text lists every count it reports, per store) — or the backend's reason (409 when
 * another sync is running). The stock list refreshes by itself.
 */
export function SyncInventoryButton() {
  const sync = useInventorySync()
  const names = sync.targets.map((target) => target.label)
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  // A click outside closes the panel.
  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const outcome = sync.outcome
  const problem = outcome?.failure ?? null
  const details = (outcome?.results ?? []).map(
    (result) =>
      `${result.shop ?? 'Store'}: ${result.counts
        .map((entry) => `${entry.label} ${count(entry.value)}`)
        .join(', ')}`,
  )
  const done = outcome?.message || 'Inventory synced'

  function run(dryRun: boolean) {
    sync.start(dryRun)
    setOpen(false)
  }

  return (
    <div
      ref={root}
      className="relative flex min-w-0 items-center gap-2"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation()
          setOpen(false)
          button.current?.focus()
        }
      }}
    >
      {outcome && !sync.isSyncing && !problem && (
        <span
          role="status"
          title={[outcome.message, ...details].filter(Boolean).join('\n')}
          className="bg-accent-tint text-accent hidden max-w-80 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-semibold whitespace-nowrap md:inline-flex"
        >
          <CheckCircleIcon width={14} height={14} className="shrink-0" />
          <span className="truncate">{done}</span>
        </span>
      )}
      {problem && !sync.isSyncing && (
        <span
          role="alert"
          title={[problem, ...details].join('\n')}
          className="bg-danger-bg text-danger hidden max-w-72 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-semibold md:inline-flex"
        >
          <AlertTriangleIcon width={14} height={14} className="shrink-0" />
          <span className="truncate">{problem}</span>
        </span>
      )}

      <button
        ref={button}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="true"
        aria-expanded={open}
        title={names.length > 0 ? `Sync inventory with ${names.join(', ')}` : undefined}
        disabled={sync.isSyncing || !sync.ready}
        aria-label={sync.isSyncing ? 'Syncing inventory' : 'Sync inventory'}
        className="border-border bg-bg text-text hover:border-accent hover:text-accent hover:bg-accent-tint inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[0.82rem] font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-60"
      >
        {sync.isSyncing ? (
          <SpinnerIcon width={16} height={16} className="animate-spin" />
        ) : (
          <RefreshIcon width={16} height={16} />
        )}
        <span className="hidden sm:inline" aria-hidden="true">
          {sync.isSyncing ? 'Syncing…' : 'Sync inventory'}
        </span>
        {!sync.isSyncing && (
          <ChevronDownIcon
            width={14}
            height={14}
            aria-hidden="true"
            className={`transition-transform ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {open && (
        <div
          role="group"
          aria-label="Sync inventory"
          className="border-border bg-bg absolute top-full right-0 z-30 mt-1.5 flex w-56 max-w-[calc(100vw-2rem)] flex-col rounded-xl border p-2 shadow-lg"
        >
          <button
            type="button"
            autoFocus
            disabled={!sync.ready || sync.isSyncing}
            onClick={() => run(false)}
            className={`${SMALL_BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover w-full border-transparent`}
          >
            <RefreshIcon width={14} height={14} />
            Sync inventory now
          </button>
        </div>
      )}
    </div>
  )
}
