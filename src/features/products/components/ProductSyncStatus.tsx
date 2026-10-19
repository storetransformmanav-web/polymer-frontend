import {
  AlertTriangleIcon,
  CheckCircleIcon,
  SpinnerIcon,
} from '../../../components/ui/icons.tsx'
import { useProductSync } from '../hooks/useProductSync.ts'
import { readableSyncError, syncFailureHint } from '../utils/sync.ts'

interface ProductSyncStatusProps {
  /** The product's CRM id. */
  id: string
  shop: string | null | undefined
  /** The status the save reported, shown until the first history answer arrives. */
  initialStatus: string | null
}

/**
 * How the last edit's push to the store went: still going, done, or failed
 * (with a Retry). An edit is saved in the CRM at once and sent to the store
 * right after, so this is the answer to "did it actually reach Shopify?".
 */
export function ProductSyncStatus({ id, shop, initialStatus }: ProductSyncStatusProps) {
  const sync = useProductSync(id, shop, { initialStatus })

  if (sync.state === 'failed') {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span
          role="alert"
          title={sync.failure ?? sync.status ?? undefined}
          className="bg-danger-bg text-danger inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-semibold"
        >
          <AlertTriangleIcon width={14} height={14} />
          Not sent to the store
          <button
            type="button"
            onClick={sync.retry}
            disabled={sync.isRetrying}
            className="cursor-pointer border-none bg-transparent p-0 text-[0.75rem] font-bold text-current underline underline-offset-2 disabled:opacity-60"
          >
            {sync.isRetrying ? 'Retrying…' : 'Retry'}
          </button>
          {sync.retryError && <span className="font-normal">— {sync.retryError}</span>}
        </span>
        {sync.failure && (
          // Why the store refused it, as the backend reports it (plain text).
          <span
            title={sync.failure}
            className="text-danger max-w-xl text-[0.75rem] leading-snug"
          >
            {readableSyncError(sync.failure)}
            {syncFailureHint(sync.failure) && (
              <span className="block font-semibold">{syncFailureHint(sync.failure)}</span>
            )}
          </span>
        )}
      </span>
    )
  }

  if (sync.state === 'synced') {
    return (
      <span
        role="status"
        className="bg-accent-tint text-accent inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-semibold"
      >
        <CheckCircleIcon width={14} height={14} />
        Sent to the store
      </span>
    )
  }

  return (
    <span
      role="status"
      className="bg-surface text-text-muted border-border inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.75rem] font-semibold"
    >
      <SpinnerIcon width={14} height={14} className="animate-spin" />
      Sending to the store…
    </span>
  )
}
