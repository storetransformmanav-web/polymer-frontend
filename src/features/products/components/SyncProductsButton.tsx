import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  RefreshIcon,
  SpinnerIcon,
} from '../../../components/ui/icons.tsx'
import { useProductsSync } from '../hooks/useProductsSync.ts'
import { useSyncOneProduct } from '../hooks/useSyncOneProduct.ts'
import { SyncProductsPanel } from './SyncProductsPanel.tsx'

const count = (value: number) => value.toLocaleString('en-GB')

/** How long a single product's result stays beside the button. */
const SHOW_ONE_RESULT_MS = 15_000

/**
 * "Sync products" in the top bar drops down a small panel (`SyncProductsPanel`): **one product**
 * by its Shopify ID (`POST /sync/products/{id}` — the panel closes once it has answered and the
 * result shows beside the button) or **Sync all products** — every product of the selected store
 * (or of every store, when "All shops" is selected) re-imported from Shopify. That one runs in the
 * background: the button shows the progress, and the product list keeps refreshing by itself
 * while the run goes, so products appear as they are saved rather than at the very end. The
 * panel closes on a click outside it and on Escape.
 */
export function SyncProductsButton() {
  const sync = useProductsSync()
  const one = useSyncOneProduct()
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

  // The single product's result goes away after a while (not while the panel is open again).
  const { result, reset } = one
  useEffect(() => {
    if (!result || open) return undefined
    const timer = window.setTimeout(reset, SHOW_ONE_RESULT_MS)
    return () => window.clearTimeout(timer)
  }, [result, open, reset])

  const oneDone = !open && one.result && one.request
  const differences = one.result?.differences ?? []

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
      {oneDone && (
        <span
          role="status"
          title={[one.result?.message, ...differences].filter(Boolean).join('\n')}
          className="bg-accent-tint text-accent hidden max-w-72 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-semibold whitespace-nowrap md:inline-flex"
        >
          <CheckCircleIcon width={14} height={14} className="shrink-0" />
          <span className="truncate">
            {one.request?.dryRun
              ? `Compared product ${one.request.shopifyId}: ${
                  differences.length === 0
                    ? 'no differences listed'
                    : `${differences.length} ${differences.length === 1 ? 'difference' : 'differences'}`
                }`
              : `Synced product ${one.request?.shopifyId}`}
          </span>
        </span>
      )}
      {sync.phase === 'done' && !busy && (
        <span
          role="status"
          className="bg-accent-tint text-accent hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-semibold whitespace-nowrap md:inline-flex"
        >
          <CheckCircleIcon width={14} height={14} />
          {sync.saved === null
            ? 'Sync started'
            : `Synced ${count(sync.saved)} ${sync.saved === 1 ? 'product' : 'products'}`}
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
        title={names.length > 0 ? `Sync products from ${names.join(', ')}` : undefined}
        disabled={busy || !sync.ready}
        aria-label={busy ? 'Syncing products' : 'Sync products'}
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
            : 'Sync products'}
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
        <SyncProductsPanel
          targets={sync.targets}
          one={one}
          canSyncAll={sync.ready && !busy}
          onSyncAll={sync.start}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
