import type { ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { Highlight } from '../../../components/ui/Highlight.tsx'
import { AlertTriangleIcon, EyeIcon, LockIcon } from '../../../components/ui/icons.tsx'
import { ROW_ACTION } from '../../../components/ui/rowActions.ts'
import { useMediaQuery } from '../../../hooks/useMediaQuery.ts'
import type { AccessLock } from '../../../lib/api/endpoints.ts'
import { formatDate, formatDateTime } from '../../../lib/format.ts'
import { hiddenFrom, syncLabel, syncTone } from '../utils/format.ts'
import { LockImage } from './LockCard.tsx'

const TH_BASE =
  'text-text border-border-strong bg-table-head sticky top-0 z-[1] border-b px-3.5 py-3 text-left text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase backdrop-blur'
// No alignment in the cell base: a `text-left` here would fight any `text-center` added later.
const TD = 'px-3.5 py-2.5 whitespace-nowrap'
const FROM_XL = 'hidden xl:table-cell'
const SKELETON_ROWS = 8

interface LocksListProps {
  items: AccessLock[]
  isPending: boolean
  error: string | null
  hasFilters: boolean
  /** Rows belong to the previous query while the new one loads. */
  isStale: boolean
  onOpen: (lock: AccessLock) => void
  onRetry: () => void
  onClearFilters: () => void
  /** The empty list's own call to action (Add lock). */
  emptyAction?: ReactNode
}

function Chips({ values, empty }: { values: string[]; empty: string }) {
  if (values.length === 0) return <span className="text-text-muted">{empty}</span>
  return (
    <span className="flex items-center gap-1">
      {values.slice(0, 2).map((value) => (
        <span
          key={value}
          className="bg-surface border-border max-w-32 truncate rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold"
          title={value}
        >
          {value}
        </span>
      ))}
      {values.length > 2 && (
        <span
          className="text-text-muted text-[0.7rem]"
          title={values.slice(2).join(', ')}
        >
          +{values.length - 2}
        </span>
      )}
    </span>
  )
}

function StatusBadges({ lock }: { lock: AccessLock }) {
  return (
    <Badge tone={lock.enabled ? 'success' : 'neutral'} className="w-24 justify-center">
      {lock.enabled ? 'Enabled' : 'Disabled'}
    </Badge>
  )
}

function SyncBadge({ lock }: { lock: AccessLock }) {
  return (
    <span title={lock.sync_error ?? undefined}>
      <Badge tone={syncTone(lock.sync_status)} className="w-32 justify-center">
        {syncLabel(lock.sync_status)}
      </Badge>
    </span>
  )
}

function ViewButton({
  lock,
  onOpen,
}: {
  lock: AccessLock
  onOpen: (lock: AccessLock) => void
}) {
  return (
    <button
      type="button"
      aria-label={`View lock on ${lock.title}`}
      title="View"
      onClick={() => onOpen(lock)}
      className={ROW_ACTION}
    >
      <EyeIcon />
    </button>
  )
}

const count = (value: number | null | undefined) =>
  value == null ? '—' : value.toLocaleString('en-GB')

const updated = (value: string | null | undefined) =>
  value ? <span title={formatDateTime(value)}>{formatDate(value)}</span> : '—'

function Message({ children }: { children: ReactNode }) {
  return (
    <div className="text-text-muted flex flex-col items-center gap-3 px-4 py-14 text-center text-[0.9rem]">
      {children}
    </div>
  )
}

const MESSAGE_BUTTON =
  'border-border bg-bg text-text hover:border-accent cursor-pointer rounded-lg border px-4 py-2 text-[0.82rem] font-semibold transition-colors'

/**
 * The results area: a sticky-header table from `md` up, stacked cards below it. It handles the
 * loading skeleton, error and empty states itself so the page only passes data in.
 */
export function LocksList({
  items,
  isPending,
  error,
  hasFilters,
  isStale,
  onOpen,
  onRetry,
  onClearFilters,
  emptyAction,
}: LocksListProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')

  if (error) {
    return (
      <Message>
        <AlertTriangleIcon width={28} height={28} className="text-danger" />
        <div>
          <p className="text-text font-semibold">Couldn&apos;t load the locks</p>
          <p>{error}</p>
        </div>
        <button type="button" className={MESSAGE_BUTTON} onClick={onRetry}>
          Try again
        </button>
      </Message>
    )
  }

  if (!isPending && items.length === 0) {
    return (
      <Message>
        <LockIcon width={28} height={28} />
        <div>
          <p className="text-text font-semibold">No locks found</p>
          <p>
            {hasFilters
              ? 'Nothing matches the current search and filters.'
              : 'No product is locked in this store yet. Add a lock to start.'}
          </p>
        </div>
        {hasFilters ? (
          <button type="button" className={MESSAGE_BUTTON} onClick={onClearFilters}>
            Clear all filters
          </button>
        ) : (
          emptyAction
        )}
      </Message>
    )
  }

  const dim = isStale ? 'opacity-60' : ''

  if (!isDesktop) {
    return (
      <ul
        aria-busy={isPending || isStale}
        className={`flex flex-col gap-2.5 p-3 transition-opacity duration-150 ${dim}`}
      >
        {isPending && (
          <li role="status" className="sr-only">
            Loading locks…
          </li>
        )}
        {isPending
          ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <li
                key={index}
                aria-hidden="true"
                className="border-border bg-surface h-24 animate-pulse rounded-xl border"
              />
            ))
          : items.map((lock) => (
              <li
                key={lock.product_id}
                className="border-border bg-bg flex items-start gap-3 rounded-xl border p-3"
              >
                <LockImage src={lock.image_url} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="truncate text-[0.88rem] font-semibold">
                      <Highlight text={lock.title} />
                    </span>
                    <ViewButton lock={lock} onOpen={onOpen} />
                  </span>
                  <span className="text-text-muted truncate text-[0.78rem]">
                    <Highlight text={lock.handle ?? ''} />
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <StatusBadges lock={lock} />
                    <SyncBadge lock={lock} />
                  </span>
                  <span className="text-text-muted mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.78rem]">
                    <Chips values={lock.tags} empty="Signed-in customers" />
                    <span>{count(lock.customers_with_access)} with access</span>
                  </span>
                </div>
              </li>
            ))}
      </ul>
    )
  }

  return (
    <div
      aria-busy={isPending || isStale}
      className="max-h-[min(68svh,760px)] overflow-auto lg:max-h-none lg:min-h-0 lg:flex-1"
    >
      <table
        className={`w-full min-w-[820px] border-collapse text-[0.85rem] transition-opacity duration-150 ${dim}`}
      >
        <thead>
          <tr>
            <th className={TH_BASE}>Product</th>
            <th className={TH_BASE}>Keys (tags)</th>
            <th className={`${TH_BASE} text-right`}>With access</th>
            <th className={`${TH_BASE} ${FROM_XL}`}>Hidden from</th>
            <th className={`${TH_BASE} text-center`}>Status</th>
            <th className={`${TH_BASE} text-center`}>Shopify</th>
            <th className={`${TH_BASE} ${FROM_XL}`}>Updated</th>
            <th className={`${TH_BASE} w-24 text-center`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {isPending && (
            <tr className="sr-only">
              <td role="status">Loading locks…</td>
            </tr>
          )}
          {isPending
            ? Array.from({ length: SKELETON_ROWS }, (_, row) => (
                <tr key={row} aria-hidden="true" className="border-border border-b">
                  {Array.from({ length: 6 }, (_, cell) => (
                    <td key={cell} className={TD}>
                      <div className="bg-border/70 h-4 w-full max-w-24 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            : items.map((lock) => (
                <tr
                  key={lock.product_id}
                  className="border-border even:bg-surface hover:bg-accent-tint/60 border-b transition-colors"
                >
                  <td className={TD}>
                    <span className="flex items-center gap-3">
                      <LockImage src={lock.image_url} />
                      <span className="flex min-w-0 flex-col">
                        <button
                          type="button"
                          onClick={() => onOpen(lock)}
                          className="text-text hover:text-accent max-w-72 cursor-pointer truncate border-none bg-transparent p-0 text-left font-semibold transition-colors"
                          title={lock.title}
                        >
                          <Highlight text={lock.title} />
                        </button>
                        <span
                          className="text-text-muted max-w-72 truncate text-[0.78rem]"
                          title={lock.handle ?? undefined}
                        >
                          <Highlight text={lock.handle ?? ''} />
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className={TD}>
                    <Chips values={lock.tags} empty="Signed-in customers" />
                  </td>
                  <td className={`${TD} text-right`}>
                    {count(lock.customers_with_access)}
                  </td>
                  <td className={`${TD} ${FROM_XL}`}>
                    <Chips values={hiddenFrom(lock)} empty="—" />
                  </td>
                  <td className={`${TD} text-center`}>
                    <StatusBadges lock={lock} />
                  </td>
                  <td className={`${TD} text-center`}>
                    <SyncBadge lock={lock} />
                  </td>
                  <td className={`${TD} ${FROM_XL}`}>{updated(lock.updated_at)}</td>
                  <td className={`${TD} text-center`}>
                    <ViewButton lock={lock} onOpen={onOpen} />
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  )
}
