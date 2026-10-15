import { Badge, type BadgeTone } from '../../../components/ui/Badge.tsx'
import {
  DETAIL_TD as TD,
  DETAIL_TH as TH,
  DetailEmpty,
  DetailSection,
  DetailTable,
} from '../../../components/ui/DetailSection.tsx'
import { RefreshIcon } from '../../../components/ui/icons.tsx'
import { formatDateTime } from '../../../lib/format.ts'
import type { ProductPush } from '../../../lib/api/endpoints.ts'
import type { ProductSyncHistory as History } from '../hooks/useProductSyncHistory.ts'
import { classifySync, type SyncState } from '../utils/sync.ts'

const TONES: Record<SyncState, BadgeTone> = {
  synced: 'success',
  failed: 'danger',
  syncing: 'warning',
}

const LABELS: Record<SyncState, string> = {
  synced: 'Synced',
  failed: 'Failed',
  syncing: 'In progress',
}

/** "update" → "Update". The backend's wording otherwise, as text. */
const title = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : '—'

const when = (value: string | null | undefined) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : formatDateTime(value)
}

/** The fields a push carried, e.g. "title, vendor" (names only — never rendered as markup). */
const changed = (push: ProductPush) =>
  push.changes ? Object.keys(push.changes).join(', ') || '—' : '—'

function Row({ push }: { push: ProductPush }) {
  const state = classifySync(push.status)
  return (
    <tr className="border-border even:bg-surface/50 border-b last:border-b-0">
      <td className={TD}>{title(push.action)}</td>
      <td className={TD}>
        <span title={push.status}>
          <Badge tone={TONES[state]}>{LABELS[state]}</Badge>
        </span>
      </td>
      <td className={`${TD} text-right`}>{push.attempts}</td>
      <td className={TD}>{when(push.created_at)}</td>
      <td className={TD}>{when(push.finished_at)}</td>
      <td className={`${TD} max-w-56 truncate`} title={changed(push)}>
        {changed(push)}
      </td>
      <td
        className={`${TD} ${push.error ? 'text-danger' : ''} max-w-72 truncate`}
        title={push.error ?? undefined}
      >
        {push.error || '—'}
      </td>
    </tr>
  )
}

function SkeletonRows() {
  return (
    <div
      role="status"
      aria-label="Loading sync history"
      className="flex flex-col gap-2.5"
    >
      {[0, 1, 2].map((n) => (
        <div key={n} className="bg-border/70 h-9 animate-pulse rounded-lg" />
      ))}
    </div>
  )
}

/**
 * Below all the details: every recent push of this product to its store — what
 * kind, whether it arrived, how many attempts, when, what it carried and why it
 * failed. It reads the cached history, so it appears at once on reopening, and
 * it keeps itself current while a push is in progress.
 */
export function ProductSyncHistory({ history }: { history: History }) {
  const { items, isPending, isFetching, error, refresh } = history

  return (
    <DetailSection
      title="Sync History"
      count={isPending || error ? undefined : items.length}
      icon={RefreshIcon}
      actions={
        isFetching && !isPending ? (
          <span role="status" className="text-text-muted text-[0.75rem]">
            Updating…
          </span>
        ) : null
      }
    >
      {isPending ? (
        <SkeletonRows />
      ) : error ? (
        <DetailEmpty icon={RefreshIcon}>
          <p className="text-text font-semibold">Couldn&apos;t load the sync history</p>
          <p>{error}</p>
          <button
            type="button"
            onClick={refresh}
            className="border-border bg-bg text-text hover:border-accent mt-1 cursor-pointer rounded-lg border px-4 py-2 text-[0.82rem] font-semibold transition-colors"
          >
            Try again
          </button>
        </DetailEmpty>
      ) : items.length === 0 ? (
        <DetailEmpty icon={RefreshIcon}>
          <p className="text-text font-semibold">No syncs yet</p>
          <p>Changes made here are sent to the store and listed here.</p>
        </DetailEmpty>
      ) : (
        <DetailTable>
          <thead>
            <tr>
              <th className={TH}>Action</th>
              <th className={TH}>Status</th>
              <th className={`${TH} text-right`}>Attempts</th>
              <th className={TH}>Started</th>
              <th className={TH}>Finished</th>
              <th className={TH}>Changes</th>
              <th className={TH}>Error</th>
            </tr>
          </thead>
          <tbody>
            {items.map((push) => (
              <Row key={push.id} push={push} />
            ))}
          </tbody>
        </DetailTable>
      )}
    </DetailSection>
  )
}
