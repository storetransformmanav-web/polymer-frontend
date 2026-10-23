import type { ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import {
  AlertTriangleIcon,
  SearchIcon,
  TrashIcon,
} from '../../../components/ui/icons.tsx'
import { useMediaQuery } from '../../../hooks/useMediaQuery.ts'
import type { UserItem } from '../../../lib/api/endpoints.ts'
import { formatDate, formatDateTime, initials } from '../../../lib/format.ts'
import { isAdminRole, roleLabel, roleTone, userName } from '../utils/format.ts'

const TH_BASE =
  'text-text-muted border-border bg-accent-tint/60 sticky top-0 z-[1] border-b px-3.5 py-3 text-left text-[0.7rem] font-bold tracking-wide whitespace-nowrap uppercase backdrop-blur'
// No alignment in the cell base: cells are left-aligned by default, and a
// `text-left` here would fight any `text-center`/`text-right` added later.
const TD = 'px-3.5 py-2.5 whitespace-nowrap'
// Wider-screen-only columns, so the table never needs sideways scrolling on laptops.
const FROM_XL = 'hidden xl:table-cell'
const FROM_2XL = 'hidden 2xl:table-cell'
const SKELETON_ROWS = 8
const DELETE_BUTTON =
  'text-text-muted hover:text-danger hover:bg-danger-bg inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent transition-colors'

interface UsersListProps {
  items: UserItem[]
  isPending: boolean
  error: string | null
  hasFilters: boolean
  /** Rows belong to the previous query while the new one loads. */
  isStale: boolean
  /** Store key → display name, so a user's stores read "Polymer UK" rather than "polymer-uk". */
  shopNames: Record<string, string>
  /** The trash button of a row / card: ask to delete this user. */
  onDelete: (user: UserItem) => void
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

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge tone={active ? 'success' : 'neutral'}>{active ? 'Active' : 'Inactive'}</Badge>
  )
}

function SignIn({ user }: { user: UserItem }) {
  return user.google_linked ? (
    <Badge tone="default">Google</Badge>
  ) : (
    <Badge tone="neutral">Email code</Badge>
  )
}

/** Admins see every store; everyone else is limited to the stores they were given. */
function Stores({
  user,
  shopNames,
}: {
  user: UserItem
  shopNames: Record<string, string>
}) {
  if (isAdminRole(user.role)) return <span className="text-text-muted">All stores</span>
  if (user.shop_keys.length === 0) return <span className="text-text-muted">None</span>

  const names = user.shop_keys.map((key) => shopNames[key] ?? key)
  return (
    <span className="flex items-center gap-1">
      {names.slice(0, 2).map((name) => (
        <span
          key={name}
          className="bg-surface border-border max-w-28 truncate rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold"
          title={name}
        >
          {name}
        </span>
      ))}
      {names.length > 2 && (
        <span className="text-text-muted text-[0.7rem]" title={names.slice(2).join(', ')}>
          +{names.length - 2}
        </span>
      )}
    </span>
  )
}

function LastLogin({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-text-muted">Never</span>
  return <span title={formatDateTime(value)}>{formatDate(value)}</span>
}

const dateOrDash = (value: string | null | undefined) => (value ? formatDate(value) : '—')

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
 * page only passes data in.
 */
export function UsersList({
  items,
  isPending,
  error,
  hasFilters,
  isStale,
  shopNames,
  onDelete,
  onRetry,
  onClearFilters,
}: UsersListProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')

  if (error) {
    return (
      <Message>
        <AlertTriangleIcon width={28} height={28} className="text-danger" />
        <div>
          <p className="text-text font-semibold">Couldn&apos;t load users</p>
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
          <p className="text-text font-semibold">No users found</p>
          <p>
            {hasFilters
              ? 'Nothing matches the current search and filters.'
              : 'There are no users yet.'}
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
            Loading users…
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
          : items.map((user) => {
              const name = userName(user)
              return (
                <li
                  key={user.id}
                  className="border-border bg-bg flex items-start gap-3 rounded-xl border p-3"
                >
                  <Avatar name={name} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="truncate text-[0.88rem] font-semibold">
                        {name}
                      </span>
                      <button
                        type="button"
                        aria-label={`Delete ${name}`}
                        title="Delete"
                        onClick={() => onDelete(user)}
                        className={DELETE_BUTTON}
                      >
                        <TrashIcon />
                      </button>
                    </span>
                    <span className="text-text-muted truncate text-[0.78rem]">
                      {user.email}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.82rem]">
                      <Badge tone={roleTone(user.role)}>{roleLabel(user)}</Badge>
                      <StatusBadge active={user.is_active} />
                      <SignIn user={user} />
                    </span>
                    <span className="text-text-muted mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.78rem]">
                      <Stores user={user} shopNames={shopNames} />
                      <span>
                        Last login: <LastLogin value={user.last_login_at} />
                      </span>
                    </span>
                  </div>
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
            <th className={TH_BASE}>User</th>
            <th className={TH_BASE}>Role</th>
            <th className={TH_BASE}>Status</th>
            <th className={`${TH_BASE} ${FROM_XL}`}>Phone</th>
            <th className={TH_BASE}>Stores</th>
            <th className={`${TH_BASE} ${FROM_XL}`}>Sign-in</th>
            <th className={TH_BASE}>Last Login</th>
            <th className={`${TH_BASE} ${FROM_2XL}`}>Created</th>
            <th className={`${TH_BASE} w-20 text-center`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {isPending && (
            <tr className="sr-only">
              <td role="status">Loading users…</td>
            </tr>
          )}
          {isPending
            ? Array.from({ length: SKELETON_ROWS }, (_, row) => (
                <tr key={row} aria-hidden="true" className="border-border border-b">
                  {Array.from({ length: 7 }, (_, cell) => (
                    <td key={cell} className={TD}>
                      <div className="bg-border/70 h-4 w-full max-w-24 animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            : items.map((user) => {
                const name = userName(user)
                return (
                  <tr
                    key={user.id}
                    className="border-border even:bg-surface hover:bg-accent-tint/60 border-b transition-colors"
                  >
                    <td className={TD}>
                      <span className="flex items-center gap-3">
                        <Avatar name={name} />
                        <span className="flex min-w-0 flex-col">
                          <span className="max-w-56 truncate font-semibold" title={name}>
                            {name}
                          </span>
                          <span
                            className="text-text-muted max-w-56 truncate text-[0.78rem]"
                            title={user.email}
                          >
                            {user.email}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className={TD}>
                      <Badge tone={roleTone(user.role)}>{roleLabel(user)}</Badge>
                    </td>
                    <td className={TD}>
                      <StatusBadge active={user.is_active} />
                    </td>
                    <td className={`${TD} ${FROM_XL}`}>
                      {user.phone || <span className="text-text-muted">—</span>}
                    </td>
                    <td className={TD}>
                      <Stores user={user} shopNames={shopNames} />
                    </td>
                    <td className={`${TD} ${FROM_XL}`}>
                      <SignIn user={user} />
                    </td>
                    <td className={TD}>
                      <LastLogin value={user.last_login_at} />
                    </td>
                    <td className={`${TD} ${FROM_2XL}`}>{dateOrDash(user.created_at)}</td>
                    <td className={`${TD} text-center`}>
                      <button
                        type="button"
                        aria-label={`Delete ${name}`}
                        title="Delete"
                        onClick={() => onDelete(user)}
                        className={DELETE_BUTTON}
                      >
                        <TrashIcon />
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
