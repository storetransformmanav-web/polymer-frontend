import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  RefreshIcon,
  SpinnerIcon,
} from '../../../components/ui/icons.tsx'
import { useOrdersSync } from '../hooks/useOrdersSync.ts'
import { SyncOrdersPanel } from './SyncOrdersPanel.tsx'

const count = (value: number) => value.toLocaleString('en-GB')

/**
 * "Sync orders" in the top bar, in the same place as "Sync products": it drops down a small
 * panel (`SyncOrdersPanel`) — **new and changed orders**, or a **refresh of the last N days** —
 * which starts the background import (`POST /sync/orders`) and closes. The button then shows
 * the progress, and the orders list keeps refreshing by itself while the run goes, so orders
 * appear as they are saved rather than only at the end. The panel closes on a click outside it
 * and on Escape.
 */
export function SyncOrdersButton() {
  const sync = useOrdersSync()
  const busy = sync.isStarting || sync.phase === 'running'
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
      {sync.phase === 'done' && !busy && (
        <span
          role="status"
          className="bg-accent-tint text-accent hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-semibold whitespace-nowrap md:inline-flex"
        >
          <CheckCircleIcon width={14} height={14} />
          {sync.saved === null
            ? 'Sync started'
            : `Synced ${count(sync.saved)} ${sync.saved === 1 ? 'order' : 'orders'}`}
        </span>
      )}
      {sync.error && !busy && (
        <span
          role="alert"
          title={sync.error}
          className="bg-danger-bg text-danger hidden max-w-72 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-semibold md:inline-flex"
        >
          <AlertTriangleIcon width={14} height={14} className="shrink-0" />
          <span className="truncate">{sync.error}</span>
        </span>
      )}

      <button
        ref={button}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="true"
        aria-expanded={open}
        title={names.length > 0 ? `Sync orders from ${names.join(', ')}` : undefined}
        disabled={busy || !sync.ready}
        aria-label={busy ? 'Syncing orders' : 'Sync orders'}
        className="border-border bg-bg text-text hover:border-accent hover:text-accent hover:bg-accent-tint inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[0.82rem] font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-60"
      >
        {busy ? (
          <SpinnerIcon width={16} height={16} className="animate-spin" />
        ) : (
          <RefreshIcon width={16} height={16} />
        )}
        <span className="hidden sm:inline" aria-hidden="true">
          {busy
            ? sync.processed > 0
              ? `Syncing… ${count(sync.processed)}`
              : 'Syncing…'
            : 'Sync orders'}
        </span>
        {!busy && (
          <ChevronDownIcon
            width={14}
            height={14}
            aria-hidden="true"
            className={`transition-transform ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {open && (
        <SyncOrdersPanel
          targets={sync.targets}
          canSync={sync.ready && !busy}
          onSync={sync.start}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
