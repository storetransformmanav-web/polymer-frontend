import {
  AlertTriangleIcon,
  CheckCircleIcon,
  RefreshIcon,
  SpinnerIcon,
} from '../../../components/ui/icons.tsx'
import { useCustomersSync } from '../hooks/useCustomersSync.ts'

const count = (value: number) => value.toLocaleString('en-GB')

/**
 * "Sync customers" in the top bar: one click re-imports every customer of the selected store
 * (or of every store, with "All shops") from Shopify — no confirmation, the tooltip names the
 * stores. It runs in the background on the server: the button shows "Syncing… N" while it goes,
 * the customers list refreshes by itself as customers are saved, and the result ("Synced 9,762
 * customers", or the backend's reason) stays beside the button for a while.
 */
export function SyncCustomersButton() {
  const sync = useCustomersSync()
  const busy = sync.isStarting || sync.phase === 'running'
  const names = sync.targets.map((target) => target.label)

  return (
    <div className="flex min-w-0 items-center gap-2">
      {sync.phase === 'done' && !busy && (
        <span
          role="status"
          className="bg-accent-tint text-accent hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-semibold whitespace-nowrap md:inline-flex"
        >
          <CheckCircleIcon width={14} height={14} />
          {sync.saved === null
            ? 'Sync started'
            : `Synced ${count(sync.saved)} ${sync.saved === 1 ? 'customer' : 'customers'}`}
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
        type="button"
        onClick={sync.start}
        title={names.length > 0 ? `Sync customers from ${names.join(', ')}` : undefined}
        disabled={busy || !sync.ready}
        aria-label={busy ? 'Syncing customers' : 'Sync customers'}
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
            : 'Sync customers'}
        </span>
      </button>
    </div>
  )
}
