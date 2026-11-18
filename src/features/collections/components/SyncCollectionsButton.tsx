import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  RefreshIcon,
  SpinnerIcon,
} from '../../../components/ui/icons.tsx'
import { useCollectionsSync } from '../hooks/useCollectionsSync.ts'

const count = (value: number) => value.toLocaleString('en-GB')

const HEADING = 'text-text-muted text-[0.68rem] font-bold tracking-wide uppercase'
const SMALL_BUTTON =
  'inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 text-[0.8rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60'

/**
 * "Sync collections" in the top bar, laid out like the Sync orders and Sync products buttons: a
 * click drops down a small panel with one choice — **Sync collections** (`all_products=false`, the
 * API's default: what changed in Shopify, with the products of the changed collections). The backend
 * answers when it has finished, so the button shows "Syncing…" meanwhile and then the result beside
 * it — "Synced 155 collections · 6 updated" (the hover text has the full figures per store, and a
 * line says when some collections' products are left for the next sync) or the backend's reason.
 * The collections list refreshes by itself.
 */
export function SyncCollectionsButton() {
  const sync = useCollectionsSync()
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
  const total = (
    pick: (result: NonNullable<typeof outcome>['results'][number]) => number,
  ) => (outcome?.results ?? []).reduce((sum, result) => sum + pick(result), 0)
  const storeError = outcome?.results.find((result) => result.error)?.error ?? null
  const problem = outcome?.failure ?? storeError
  const collections = total((result) => result.collections)
  const updated = total((result) => result.updated)
  const left = total((result) => result.leftForNextSync)
  const details = (outcome?.results ?? []).map(
    (result) =>
      `${result.shop ?? 'Store'}: ${count(result.collections)} collections, ${count(result.updated)} updated, ${count(result.unchanged)} unchanged, ${count(result.removed)} removed, ${count(result.productLinks)} product links${result.leftForNextSync > 0 ? `, ${count(result.leftForNextSync)} left for the next sync` : ''}${result.error ? ` — ${result.error}` : ''}`,
  )

  function run() {
    sync.start(false)
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
      {outcome && !sync.isSyncing && outcome.results.length > 0 && !problem && (
        <span
          role="status"
          title={[outcome.message, ...details].filter(Boolean).join('\n')}
          className="bg-accent-tint text-accent hidden max-w-80 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-semibold whitespace-nowrap md:inline-flex"
        >
          <CheckCircleIcon width={14} height={14} className="shrink-0" />
          <span className="truncate">
            {`Synced ${count(collections)} ${collections === 1 ? 'collection' : 'collections'}`}
            {` · ${count(updated)} updated`}
            {left > 0 ? ` · ${count(left)} left for the next sync` : ''}
          </span>
        </span>
      )}
      {outcome && !sync.isSyncing && outcome.results.length === 0 && !problem && (
        <span
          role="status"
          title={outcome.message}
          className="bg-accent-tint text-accent hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-semibold whitespace-nowrap md:inline-flex"
        >
          <CheckCircleIcon width={14} height={14} />
          {outcome.message || 'Collections synced'}
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
        title={names.length > 0 ? `Sync collections from ${names.join(', ')}` : undefined}
        disabled={sync.isSyncing || !sync.ready}
        aria-label={sync.isSyncing ? 'Syncing collections' : 'Sync collections'}
        className="border-border bg-bg text-text hover:border-accent hover:text-accent hover:bg-accent-tint inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[0.82rem] font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-60"
      >
        {sync.isSyncing ? (
          <SpinnerIcon width={16} height={16} className="animate-spin" />
        ) : (
          <RefreshIcon width={16} height={16} />
        )}
        <span className="hidden sm:inline" aria-hidden="true">
          {sync.isSyncing ? 'Syncing…' : 'Sync collections'}
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
          aria-label="Sync collections"
          className="border-border bg-bg absolute top-full right-0 z-30 mt-1.5 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2.5 rounded-xl border p-3 shadow-lg"
        >
          <div className="flex flex-col gap-1.5">
            <span className={HEADING}>Changed collections</span>
            <button
              type="button"
              autoFocus
              disabled={!sync.ready || sync.isSyncing}
              onClick={run}
              className={`${SMALL_BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover w-full border-transparent`}
            >
              <RefreshIcon width={14} height={14} />
              Sync collections
            </button>
            <span className="text-text-muted text-center text-[0.7rem]">
              What changed in {names.join(', ') || 'the store'}, in Shopify.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
