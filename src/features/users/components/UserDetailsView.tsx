import { useEffect, useState, type ReactNode } from 'react'
import {
  DetailsHeader,
  HeaderChip,
  HeaderTile,
  StatusPill,
} from '../../../components/ui/DetailsHeader.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import {
  AlertTriangleIcon,
  CalendarIcon,
  ClockIcon,
  TagIcon,
  UserCogIcon,
} from '../../../components/ui/icons.tsx'
import type { Role, Shop } from '../../../lib/api/endpoints.ts'
import { formatDate, initials } from '../../../lib/format.ts'
import type { useUserDetails } from '../hooks/useUserDetails.ts'
import { roleLabel, userName } from '../utils/format.ts'
import { UserOverviewPanel, UserSecurityAccessPanel } from './UserDetailPanels.tsx'
import { UserUpdateDialog, type UserUpdateRequest } from './UserUpdateDialog.tsx'

type TabId = 'overview' | 'security'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'security', label: 'Security & Access' },
]

/** A header chip's fact with its name in front of it ("Role: Administrator"). */
const labelled = (label: string, value: ReactNode) => (
  <span className="flex min-w-0 items-center gap-1.5">
    <span aria-hidden="true" className="text-text-muted font-normal">
      {label}:
    </span>
    <span className="min-w-0 font-semibold">{value}</span>
  </span>
)

interface UserDetailsViewProps {
  details: ReturnType<typeof useUserDetails>
  /** Store key → display name. */
  shopNames: Record<string, string>
  /** Every role (the role dropdown) and every store the signed-in user can see (store access). */
  roles: Role[]
  shops: Shop[]
  onBack: () => void
}

/** The change a small pencil asked for, waiting for "Yes, update". */
interface Asking {
  request: UserUpdateRequest
  /** Runs once the update went through. */
  onSaved?: () => void
}

/** How long the "saved" line stays. */
const NOTICE_MS = 6000

/**
 * A user's full details, shown in place of the list (same page, no overlay) — laid out like
 * a product's: a header, a row of tabs and collapsible cards. The header and summary draw
 * straight from the list row while the full record loads, so nothing waits on the network
 * when you come from the list.
 */
export function UserDetailsView({
  details,
  shopNames,
  roles,
  shops,
  onBack,
}: UserDetailsViewProps) {
  const { user, preview } = details
  const [tab, setTab] = useState<TabId>('overview')
  const [asking, setAsking] = useState<Asking | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [notice])

  function ask(request: UserUpdateRequest, onSaved?: () => void) {
    setNotice(null)
    setAsking({ request, onSaved })
  }

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
      <DetailsHeader
        visual={<HeaderTile>{initials(name) || '?'}</HeaderTile>}
        title={name}
        status={
          <>
            {known && (
              <StatusPill
                label={`Status: ${known.is_active ? 'Active' : 'Inactive'}`}
                tone={known.is_active ? 'success' : 'neutral'}
              />
            )}
            {details.isRefreshing && (
              <span className="text-text-muted text-[0.75rem]" role="status">
                Updating…
              </span>
            )}
          </>
        }
        chips={
          known && (
            <>
              <HeaderChip icon={UserCogIcon} label="Role">
                {labelled('Role', roleLabel(known))}
              </HeaderChip>
              {(user?.employee_code ?? user?.employee?.employee_code) && (
                <HeaderChip icon={TagIcon} label="Employee code">
                  {labelled(
                    'Employee code',
                    user?.employee_code ?? user?.employee?.employee_code,
                  )}
                </HeaderChip>
              )}
              {known.created_at && (
                <HeaderChip icon={CalendarIcon} label="User since">
                  {labelled('User since', formatDate(known.created_at))}
                </HeaderChip>
              )}
              <HeaderChip icon={ClockIcon} label="Last login">
                {labelled(
                  'Last login',
                  known.last_login_at ? formatDate(known.last_login_at) : 'Never',
                )}
              </HeaderChip>
            </>
          )
        }
        onBack={onBack}
        className="shrink-0 px-4 py-3 sm:px-5"
      />

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
              className={`-mb-px flex shrink-0 cursor-pointer items-center gap-2 border-0 border-b-2 bg-transparent px-3 py-2.5 text-[0.85rem] font-semibold whitespace-nowrap transition-colors ${
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
        className="bg-surface p-3 sm:p-4"
      >
        {notice && (
          <div className="mb-3">
            <FormMessage tone="success">{notice}</FormMessage>
          </div>
        )}
        {tab === 'overview' && <UserOverviewPanel user={user} onAsk={ask} />}
        {tab === 'security' && (
          <UserSecurityAccessPanel
            user={user}
            shops={shops}
            shopNames={shopNames}
            onAsk={ask}
          />
        )}
      </div>

      {/* Outside the tab panel, so an Escape in the question never reaches an edit around it. */}
      {asking && known && (
        <UserUpdateDialog
          key={`update-${known.id}`}
          userId={known.id}
          name={name}
          request={asking.request}
          roles={roles}
          onClose={() => setAsking(null)}
          onDone={(message) => {
            asking.onSaved?.()
            setAsking(null)
            setNotice(message || 'Saved.')
          }}
        />
      )}
    </article>
  )
}
