import { useEffect } from 'react'
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  SpinnerIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import type { StockWrite } from '../../../app/store/inventorySlice.ts'
import { useStockWrites } from '../hooks/useStockWrites.ts'

/** How long a confirmed change stays in the notices. */
const CONFIRMED_SHOWN_MS = 6000

const TONE = {
  pending: 'border-border-strong bg-bg',
  synced: 'border-accent bg-accent-tint/40',
  error: 'border-danger bg-danger-bg',
} as const

function Notice({
  write,
  onDismiss,
  onRetry,
}: {
  write: StockWrite
  onDismiss: () => void
  onRetry: () => void
}) {
  // A confirmed change clears itself.
  useEffect(() => {
    if (write.status !== 'synced') return undefined
    const timer = window.setTimeout(onDismiss, CONFIRMED_SHOWN_MS)
    return () => window.clearTimeout(timer)
  }, [write.status, onDismiss])

  return (
    <li
      role={write.status === 'error' ? 'alert' : 'status'}
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border px-4 py-2.5 text-[0.85rem] ${TONE[write.status]}`}
    >
      {write.status === 'pending' && (
        <SpinnerIcon
          width={16}
          height={16}
          className="text-accent shrink-0 animate-spin"
        />
      )}
      {write.status === 'synced' && (
        <CheckCircleIcon width={17} height={17} className="text-accent shrink-0" />
      )}
      {write.status === 'error' && (
        <AlertTriangleIcon width={17} height={17} className="text-danger shrink-0" />
      )}
      <span className="min-w-0 flex-1">
        <strong className="font-semibold">
          {write.status === 'pending'
            ? 'Saved. Sending to Shopify…'
            : write.status === 'synced'
              ? 'Confirmed by Shopify'
              : 'Shopify did not accept this change'}
        </strong>
        <span className="text-text-muted"> · {write.label}</span>
        {write.status === 'error' && write.error && (
          <span className="text-danger block text-[0.8rem]">{write.error}</span>
        )}
      </span>
      {write.status === 'error' && (
        <button
          type="button"
          onClick={onRetry}
          className="border-border bg-bg text-text hover:border-accent inline-flex h-8 cursor-pointer items-center rounded-lg border px-3 text-[0.78rem] font-semibold transition-colors"
        >
          Try again
        </button>
      )}
      {write.status !== 'pending' && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="text-text-muted hover:text-text inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent"
        >
          <XIcon width={14} height={14} />
        </button>
      )}
    </li>
  )
}

/**
 * Where each stock change is on its way to Shopify: "Saved. Sending to Shopify…" while it is
 * `pending` (followed every 1–2 seconds for about 30), "Confirmed by Shopify" once it is
 * `synced` (it clears itself), or the store's reason with **Try again** when it is refused.
 */
export function SyncNotices() {
  const { writes, dismiss, retry } = useStockWrites()
  if (writes.length === 0) return null
  return (
    <ul aria-label="Stock changes" className="m-0 flex list-none flex-col gap-2 p-0">
      {writes.map((write) => (
        <Notice
          key={write.id}
          write={write}
          onDismiss={() => dismiss(write.id)}
          onRetry={() => void retry(write)}
        />
      ))}
    </ul>
  )
}
