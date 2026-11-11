import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge.tsx'
import { ExpandableChips } from '../../../components/ui/ExpandableChips.tsx'
import { Highlight } from '../../../components/ui/Highlight.tsx'
import { AlertTriangleIcon, EyeIcon, LockIcon } from '../../../components/ui/icons.tsx'
import { ROW_ACTION } from '../../../components/ui/rowActions.ts'
import { useLinkedState } from '../../../hooks/useLinkedState.ts'
import { useMediaQuery } from '../../../hooks/useMediaQuery.ts'
import type { AccessLock } from '../../../lib/api/endpoints.ts'
import { formatDate, formatDateTime } from '../../../lib/format.ts'
import { hiddenFrom, linkedProductPath, syncLabel, syncTone } from '../utils/format.ts'
import { LockImage } from './LockCard.tsx'
import { LockStatusSelect } from './LockStatusSelect.tsx'

// No alignment in the header or cell base: each column sets its own, the same for its header and
// its cells (a `text-left` here would fight the `text-center` added next to it).
const TH_BASE =
  'text-text border-border-strong bg-table-head sticky top-0 z-[1] border-b px-3.5 py-3 align-middle text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase backdrop-blur'
const TD = 'px-3.5 py-2.5 align-middle whitespace-nowrap'
// Every column but Product (a picture and a name) is centred — header and cells alike.
const TH_CENTER = `${TH_BASE} text-center`
const TD_CENTER = `${TD} text-center`
const FROM_XL = 'hidden xl:table-cell'
const SKELETON_ROWS = 8

interface LocksListProps {
  items: AccessLock[]
  /** The store the locks belong to (a status change is sent for it). */
  shop: string
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

function Chips({
  values,
  empty,
  label,
}: {
  values: string[]
  empty: string
  label: string
}) {
  if (values.length === 0) return <span className="text-text-muted">{empty}</span>
  return <ExpandableChips values={values} centered label={label} />
}

/**
 * The lock's status, read from the API's `enabled` flag — true is **Enabled**, false is **Disabled** —
 * as a dropdown pill (see `LockStatusSelect`), and an amber "Manual" when the lock has manual
 * locking on — the website then shows the product to everyone and leaves the lock to custom theme
 * code.
 */
function StatusBadges({ lock, shop }: { lock: AccessLock; shop: string }) {
  return (
    <span className="inline-flex flex-wrap items-center justify-center gap-1">
      <LockStatusSelect lock={lock} shop={shop} />
      {lock.manual_locking && (
        <span title="Manual locking is on: the website shows this product to everyone">
          <Badge tone="warning">Manual</Badge>
        </span>
      )}
    </span>
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

/**
 * The product's picture, a link to its details page (opened in this page, as a tab of Lock
 * Management). With `hint`, a small "View product details" label shows beside it on hover or
 * keyboard focus.
 */
function ProductThumb({ lock, hint = false }: { lock: AccessLock; hint?: boolean }) {
  const linkedState = useLinkedState()
  return (
    <Link
      to={linkedProductPath(lock.product_id)}
      state={linkedState(lock.title)}
      aria-label={`View product details of ${lock.title}`}
      className="group focus-visible:outline-accent relative shrink-0 rounded-lg focus-visible:outline-2"
    >
      <LockImage src={lock.image_url} />
      {hint && (
        <span
          aria-hidden="true"
          className="bg-text text-bg pointer-events-none absolute top-1/2 left-full z-20 ml-2 hidden -translate-y-1/2 rounded-md px-2 py-1 text-[0.7rem] font-semibold whitespace-nowrap shadow-md group-hover:block group-focus-visible:block"
        >
          View product details
        </span>
      )}
    </Link>
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
  shop,
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
                <ProductThumb lock={lock} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="truncate text-[0.88rem] font-semibold">
                      <Highlight text={lock.title} />
                    </span>
                    <ViewButton lock={lock} onOpen={onOpen} />
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <StatusBadges lock={lock} shop={shop} />
                    <SyncBadge lock={lock} />
                  </span>
                  <span className="text-text-muted mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.78rem]">
                    <Chips values={lock.tags} empty="Signed-in customers" label="Keys" />
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
      className="relative max-h-[min(68svh,760px)] overflow-auto lg:max-h-none lg:min-h-0 lg:flex-1"
    >
      <table
        className={`w-full min-w-[820px] border-collapse text-[0.85rem] transition-opacity duration-150 ${dim}`}
      >
        <thead>
          <tr>
            <th className={`${TH_BASE} text-left`}>Product</th>
            <th className={TH_CENTER}>Keys (tags)</th>
            <th className={TH_CENTER}>With access</th>
            <th className={`${TH_CENTER} ${FROM_XL}`}>Hidden from</th>
            <th className={TH_CENTER}>Status</th>
            <th className={TH_CENTER}>Shopify</th>
            <th className={`${TH_CENTER} ${FROM_XL}`}>Updated</th>
            <th className={`${TH_CENTER} w-24`}>Actions</th>
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
                  <td className={`${TD} text-left`}>
                    <span className="flex items-center gap-3">
                      <ProductThumb lock={lock} hint />
                      <span className="flex min-w-0 flex-col">
                        <button
                          type="button"
                          onClick={() => onOpen(lock)}
                          className="text-text hover:text-accent max-w-72 cursor-pointer truncate border-none bg-transparent p-0 text-left font-semibold transition-colors"
                          title={lock.title}
                        >
                          <Highlight text={lock.title} />
                        </button>
                      </span>
                    </span>
                  </td>
                  <td className={TD_CENTER}>
                    <Chips values={lock.tags} empty="Signed-in customers" label="Keys" />
                  </td>
                  <td className={TD_CENTER}>{count(lock.customers_with_access)}</td>
                  <td className={`${TD_CENTER} ${FROM_XL}`}>
                    <Chips values={hiddenFrom(lock)} empty="—" label="Hidden from" />
                  </td>
                  <td className={TD_CENTER}>
                    <StatusBadges lock={lock} shop={shop} />
                  </td>
                  <td className={TD_CENTER}>
                    <SyncBadge lock={lock} />
                  </td>
                  <td className={`${TD_CENTER} ${FROM_XL}`}>
                    {updated(lock.updated_at)}
                  </td>
                  <td className={TD_CENTER}>
                    <ViewButton lock={lock} onOpen={onOpen} />
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  )
}
