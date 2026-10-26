import { Highlight } from '../../../components/ui/Highlight.tsx'
import type { ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { AlertTriangleIcon, EyeIcon, SearchIcon } from '../../../components/ui/icons.tsx'
import { useMediaQuery } from '../../../hooks/useMediaQuery.ts'
import type { ActivityItem } from '../../../lib/api/endpoints.ts'
import { formatTimestamp, initials } from '../../../lib/format.ts'
import {
  actionLabel,
  actorName,
  formatDuration,
  methodTone,
  statusTone,
} from '../utils/format.ts'

const TH_BASE =
  'text-text border-border-strong bg-table-head sticky top-0 z-[1] border-b px-3.5 py-3 text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase backdrop-blur'
const TH = `${TH_BASE} text-left`
const TH_RIGHT = `${TH_BASE} text-right`
const TH_CENTER = `${TH_BASE} text-center`
// No alignment in the cell base: cells are left-aligned by default, and a
// `text-left` here would fight any `text-center`/`text-right` added later.
const TD = 'px-3.5 py-2.5 whitespace-nowrap'
// Wider-screen-only column, so the table never needs sideways scrolling on laptops.
const FROM_2XL = 'hidden 2xl:table-cell'
const SKELETON_ROWS = 8

interface ActivityListProps {
  items: ActivityItem[]
  isPending: boolean
  error: string | null
  hasFilters: boolean
  /** Rows belong to the previous query while the new one loads. */
  isStale: boolean
  /** Opens a row's full details. */
  onOpen: (item: ActivityItem) => void
  onRetry: () => void
  onClearFilters: () => void
}

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="bg-accent-tint text-accent inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[0.75rem] font-bold"
    >
      {initials(name) || '?'}
    </span>
  )
}

function MethodBadge({ method }: { method: string | null | undefined }) {
  if (!method) return <span className="text-text-muted">—</span>
  return <Badge tone={methodTone(method)}>{method.toUpperCase()}</Badge>
}

function StatusBadge({ code }: { code: number | null | undefined }) {
  if (code === null || code === undefined)
    return <span className="text-text-muted">—</span>
  return <Badge tone={statusTone(code)}>{code}</Badge>
}

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
 * The results area: a sticky-header table from `md` up, stacked cards below
 * it. Handles the loading skeleton, error and empty states itself so the
 * page only passes data in. Everything from the API is shown as text.
 */
export function ActivityList({
  items,
  isPending,
  error,
  hasFilters,
  isStale,
  onOpen,
  onRetry,
  onClearFilters,
}: ActivityListProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')

  if (error) {
    return (
      <Message>
        <AlertTriangleIcon width={28} height={28} className="text-danger" />
        <div>
          <p className="text-text font-semibold">Couldn&apos;t load activity</p>
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
        <SearchIcon width={28} height={28} />
        <div>
          <p className="text-text font-semibold">No activity found</p>
          <p>
            {hasFilters
              ? 'Nothing matches the current search and filters.'
              : 'Nothing has been recorded yet.'}
          </p>
        </div>
        {hasFilters && (
          <button type="button" className={MESSAGE_BUTTON} onClick={onClearFilters}>
            Clear all filters
          </button>
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
            Loading activity…
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
          : items.map((item) => {
              const name = actorName(item.user)
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(item)}
                    aria-label={`View activity ${item.id}`}
                    className="border-border bg-bg hover:border-accent flex w-full cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition-colors"
                  >
                    <Avatar name={name} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="line-clamp-2 text-[0.88rem] font-semibold">
                        <Highlight text={item.summary || actionLabel(item.action)} />
                      </span>
                      <span className="text-text-muted truncate text-[0.78rem]">
                        {name} · {formatTimestamp(item.time)}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[0.82rem]">
                        <MethodBadge method={item.method} />
                        <StatusBadge code={item.status_code} />
                        <span className="text-text-muted">
                          {formatDuration(item.duration_ms)}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
      </ul>
    )
  }

  return (
    <div
      aria-busy={isPending || isStale}
      className="max-h-[min(68svh,760px)] overflow-auto"
    >
      <table
        className={`w-full min-w-[720px] border-collapse text-[0.85rem] transition-opacity duration-150 ${dim}`}
      >
        <thead>
          <tr>
            <th className={TH}>Time</th>
            <th className={TH}>User</th>
            <th className={TH}>Action</th>
            <th className={TH}>Summary</th>
            <th className={TH}>Method</th>
            <th className={TH}>Status</th>
            <th className={TH_RIGHT}>Duration</th>
            <th className={`${TH} ${FROM_2XL}`}>Device</th>
            <th className={TH_CENTER}>View</th>
          </tr>
        </thead>
        <tbody>
          {isPending && (
            <tr className="sr-only">
              <td role="status">Loading activity…</td>
            </tr>
          )}
          {isPending
            ? Array.from({ length: SKELETON_ROWS }, (_, row) => (
                <tr key={row} aria-hidden="true" className="border-border border-b">
                  {Array.from({ length: 8 }, (_, cell) => (
                    <td key={cell} className={TD}>
                      <div className="bg-border/70 h-4 w-full max-w-24 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            : items.map((item) => {
                const name = actorName(item.user)
                return (
                  <tr
                    key={item.id}
                    className="border-border even:bg-surface hover:bg-accent-tint/60 border-b transition-colors"
                  >
                    <td className={TD}>{formatTimestamp(item.time)}</td>
                    <td className={TD}>
                      <span className="flex items-center gap-3">
                        <Avatar name={name} />
                        <span className="flex min-w-0 flex-col">
                          <span className="max-w-40 truncate font-semibold" title={name}>
                            {name}
                          </span>
                          {item.user?.role && (
                            <span className="text-text-muted text-[0.78rem]">
                              {item.user.role}
                            </span>
                          )}
                        </span>
                      </span>
                    </td>
                    <td className={TD}>
                      <span className="font-medium" title={item.action}>
                        {actionLabel(item.action)}
                      </span>
                    </td>
                    <td className={TD}>
                      <span className="flex min-w-0 flex-col">
                        <span
                          className="max-w-72 truncate 2xl:max-w-md"
                          title={item.summary}
                        >
                          <Highlight text={item.summary || '—'} />
                        </span>
                        {item.path && (
                          <span
                            className="text-text-muted max-w-72 truncate font-mono text-[0.74rem] 2xl:max-w-md"
                            title={item.path}
                          >
                            <Highlight text={item.path} />
                          </span>
                        )}
                      </span>
                    </td>
                    <td className={TD}>
                      <MethodBadge method={item.method} />
                    </td>
                    <td className={TD}>
                      <StatusBadge code={item.status_code} />
                    </td>
                    <td className={`${TD} text-right`}>
                      {formatDuration(item.duration_ms)}
                    </td>
                    <td className={`${TD} ${FROM_2XL}`}>
                      <span className="flex min-w-0 flex-col">
                        <span className="max-w-44 truncate" title={item.device ?? ''}>
                          {item.device || '—'}
                        </span>
                        {item.ip && (
                          <span className="text-text-muted font-mono text-[0.74rem]">
                            {item.ip}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className={`${TD} text-center`}>
                      <button
                        type="button"
                        aria-label={`View activity ${item.id}`}
                        onClick={() => onOpen(item)}
                        className="text-text-muted hover:text-accent inline-flex cursor-pointer items-center justify-center border-none bg-none p-1 transition-colors"
                      >
                        <EyeIcon />
                      </button>
                    </td>
                  </tr>
                )
              })}
        </tbody>
      </table>
    </div>
  )
}
