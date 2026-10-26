import { useState } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { DetailSkeleton } from '../../../components/ui/DetailSection.tsx'
import { AlertTriangleIcon, ArrowLeftIcon } from '../../../components/ui/icons.tsx'
import { initials } from '../../../lib/format.ts'
import type { useUserDetails } from '../hooks/useUserDetails.ts'
import { roleLabel, roleTone, userName } from '../utils/format.ts'
import { UserAccessPanel, UserOverviewPanel } from './UserDetailPanels.tsx'

type TabId = 'overview' | 'access'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'access', label: 'Access' },
]

interface UserDetailsViewProps {
  details: ReturnType<typeof useUserDetails>
  /** Store key → display name. */
  shopNames: Record<string, string>
  onBack: () => void
}

/**
 * A user's full details, shown in place of the list (same page, no overlay) — laid out like
 * a product's: a header, a row of tabs and collapsible cards. The header and summary draw
 * straight from the list row while the full record loads, so nothing waits on the network
 * when you come from the list.
 */
export function UserDetailsView({ details, shopNames, onBack }: UserDetailsViewProps) {
  const { user, preview } = details
  const [tab, setTab] = useState<TabId>('overview')

  const known = user ?? preview
  const name = known ? userName(known) : 'Loading user…'

  if (details.error) {
    return (
      <section className="border-border bg-bg flex flex-col items-center gap-3 rounded-2xl border px-4 py-16 text-center">
        <AlertTriangleIcon width={28} height={28} className="text-danger" />
        <div>
          <p className="font-semibold">Couldn&apos;t load this user</p>
          <p className="text-text-muted text-[0.9rem]">{details.error}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={details.retry}
            className="border-border bg-bg text-text hover:border-accent cursor-pointer rounded-lg border px-4 py-2 text-[0.82rem] font-semibold transition-colors"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={onBack}
            className="border-border bg-bg text-text-muted hover:text-text cursor-pointer rounded-lg border px-4 py-2 text-[0.82rem] font-semibold transition-colors"
          >
            Back to list
          </button>
        </div>
      </section>
    )
  }

  return (
    <article
      aria-label={`User ${name}`}
      className="border-border bg-bg overflow-hidden rounded-2xl border"
    >
      <header className="flex items-start gap-4 p-4 sm:p-6">
        <span
          aria-hidden="true"
          className="bg-accent-tint text-accent inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold"
        >
          {initials(name) || '?'}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg leading-snug font-bold break-words sm:text-2xl">
            {name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.85rem]">
            {known && (
              <>
                <Badge tone={roleTone(known.role)}>{roleLabel(known)}</Badge>
                <Badge tone={known.is_active ? 'success' : 'neutral'}>
                  {known.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate">{known.email}</span>
                  <CopyButton value={known.email} label="Copy email" />
                </span>
              </>
            )}
            {details.isRefreshing && (
              <span className="text-text-muted text-[0.75rem]" role="status">
                Updating…
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to list"
          className="border-border bg-bg text-text hover:border-accent flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[0.82rem] font-semibold transition-colors"
        >
          <ArrowLeftIcon width={16} height={16} />
          <span className="hidden sm:inline" aria-hidden="true">
            Back to list
          </span>
        </button>
      </header>

      <div
        role="tablist"
        aria-label="User sections"
        className="border-border flex [scrollbar-width:none] gap-1 overflow-x-auto border-y px-2 sm:px-4 [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((item) => {
          const selected = item.id === tab
          return (
            <button
              key={item.id}
              id={`user-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls="user-tabpanel"
              onClick={() => setTab(item.id)}
              className={`-mb-px flex shrink-0 cursor-pointer items-center gap-2 border-0 border-b-2 bg-transparent px-3 py-3 text-[0.85rem] font-semibold whitespace-nowrap transition-colors ${
                selected
                  ? 'border-accent text-text'
                  : 'text-text-muted hover:text-text border-transparent'
              }`}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <div
        id="user-tabpanel"
        role="tabpanel"
        aria-labelledby={`user-tab-${tab}`}
        className="bg-surface p-3 sm:p-5"
      >
        {tab === 'overview' && <UserOverviewPanel user={user} preview={preview} />}
        {tab === 'access' && !user && <DetailSkeleton />}
        {tab === 'access' && user && (
          <UserAccessPanel user={user} shopNames={shopNames} />
        )}
      </div>
    </article>
  )
}
