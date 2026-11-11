import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge.tsx'
import { ChoiceEdit } from '../../../components/ui/ChoiceEdit.tsx'
import {
  DETAIL_CARD,
  DetailSection,
  DetailSkeleton,
  Field,
  FieldGrid,
} from '../../../components/ui/DetailSection.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ExternalLinkIcon,
  LockIcon,
  SlidersIcon,
  TagIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import type { AccessLock } from '../../../lib/api/endpoints.ts'
import { formatDateTime } from '../../../lib/format.ts'
import { syncLabel, syncTone } from '../utils/format.ts'
import { FLAG_INFO, flagWord, type LockFlag } from '../utils/lockOptions.ts'
import { LockChangeConfirm, type PendingLockChange } from './LockChangeConfirm.tsx'
import { LockKeysSection } from './LockAccessEditors.tsx'
import { LockImage } from './LockCard.tsx'
import { LockAccessTab } from './LockAccessTab.tsx'
import { LockStatusSelect } from './LockStatusSelect.tsx'

const BUTTON =
  'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'
const SECONDARY = `${BUTTON} border-border bg-bg text-text hover:border-accent`

type TabId = 'overview' | 'settings' | 'access'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'settings', label: 'Settings' },
  { id: 'access', label: 'Customer Access' },
]

interface LockDetailsViewProps {
  lock: AccessLock | null
  /** Loaded, and the store has no lock with this handle. */
  notFound: boolean
  error: string | null
  onRetry: () => void
  isFetching: boolean
  shop: string
  shopName: string
  onBack: () => void
}

/**
 * One lock's page, in place of the list — laid out like a product's page: a header (picture,
 * name, status pills, Back to list), a row of tabs and collapsible cards. **Everything about the
 * lock can be changed here**: the keys and who has access have a pencil (`LockAccessEditors.tsx`,
 * `PUT /access/tags`), and every setting — Lock (Enabled / Disabled), hidden from menus / lists /
 * sitemaps, no-index, manual locking — and the access-denied message is **double-clicked** to
 * change it (a dropdown of Yes / No or Enabled / Disabled, a box for the message), then asked
 * "Are you sure?" (`LockChangeConfirm`) and sent with `POST /access/locks`; the page changes at
 * once. "Customer Access" (`GET /access/check`) changes nothing.
 */
export function LockDetailsView({
  lock,
  notFound,
  error,
  onRetry,
  isFetching,
  shop,
  shopName,
  onBack,
}: LockDetailsViewProps) {
  const [tab, setTab] = useState<TabId>('overview')
  const fillPage = tab === 'access'
  // The Settings tab was opened from Customer Access's manual-locking warning.
  const [showAdvanced, setShowAdvanced] = useState(false)
  // The setting being changed, waiting for "Yes, update".
  const [pending, setPending] = useState<PendingLockChange | null>(null)

  if (error || notFound) {
    return (
      <section className="border-border bg-bg flex flex-col items-center gap-3 rounded-2xl border px-4 py-16 text-center">
        <AlertTriangleIcon width={28} height={28} className="text-danger" />
        <div>
          <p className="font-semibold">
            {notFound ? 'This lock was not found' : 'Couldn’t load this lock'}
          </p>
          <p className="text-text-muted text-[0.9rem]">
            {notFound
              ? 'It may have been removed, or it belongs to another store.'
              : error}
          </p>
        </div>
        <div className="flex gap-2">
          {!notFound && (
            <button type="button" onClick={onRetry} className={SECONDARY}>
              Try again
            </button>
          )}
          <button type="button" onClick={onBack} className={SECONDARY}>
            Back to list
          </button>
        </div>
      </section>
    )
  }

  if (!lock) return <DetailSkeleton />

  const hasKeys = lock.tags.length > 0

  /** A yes/no (or Enabled/Disabled) setting: double-click it, choose, then confirm. */
  function flagField(flag: LockFlag) {
    const info = FLAG_INFO[flag]
    const value = lock![flag]
    return (
      <Field label={info.label}>
        <ChoiceEdit
          label={info.label}
          value={value ? 'on' : 'off'}
          options={[
            { value: 'on', label: info.on },
            { value: 'off', label: info.off },
          ]}
          display={<span>{flagWord(flag, value)}</span>}
          onCommit={(next) =>
            setPending({
              lock: lock!,
              change: { [flag]: next === 'on' },
              label: info.label,
              from: flagWord(flag, value),
              to: flagWord(flag, next === 'on'),
            })
          }
        />
      </Field>
    )
  }

  return (
    <article
      // Customer Access fills the height of the page (its table scrolls in its own box), so the
      // page itself does not scroll; the other tabs are as tall as their content.
      className={`border-border bg-bg overflow-hidden rounded-2xl border ${
        fillPage ? 'lg:flex lg:min-h-0 lg:flex-1 lg:flex-col' : 'shrink-0'
      }`}
    >
      <header className="flex shrink-0 flex-col gap-4 p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <LockImage src={lock.image_url} size="lg" />
          <div className="min-w-0 flex-1">
            {/* The name, then the lock's figures beside it — as a product's stock and price. */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <h1
                className="text-lg leading-snug font-bold break-words sm:text-2xl"
                title={lock.title}
              >
                {lock.title}
              </h1>
              <dl className="flex flex-col gap-y-2 lg:flex-row lg:flex-wrap lg:items-center">
                <div className="border-border flex items-center gap-2 lg:border-l lg:pl-5">
                  <dt className="sr-only">Customers with access</dt>
                  <dd className="flex items-center gap-2 whitespace-nowrap">
                    <UsersIcon width={18} height={18} className="text-accent shrink-0" />
                    <span className="font-semibold">
                      {lock.customers_with_access != null
                        ? lock.customers_with_access.toLocaleString('en-GB')
                        : '—'}
                    </span>
                    <span className="text-text-muted text-[0.85rem]">with access</span>
                  </dd>
                </div>
                <div className="border-border flex items-center gap-2 lg:ml-5 lg:border-l lg:pl-5">
                  <dt className="sr-only">Keys</dt>
                  <dd className="flex items-center gap-2 whitespace-nowrap">
                    <TagIcon
                      width={18}
                      height={18}
                      className="text-text-muted shrink-0"
                    />
                    <span className="font-semibold">{lock.tags.length}</span>
                    <span className="text-text-muted text-[0.85rem]">
                      {lock.tags.length === 1 ? 'key' : 'keys'}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.85rem]">
              {/* Enabled / Disabled — changed here with a dropdown, after a confirmation. */}
              <LockStatusSelect lock={lock} shop={shop} />
              <span title={lock.sync_error ?? undefined}>
                <Badge tone={syncTone(lock.sync_status)}>
                  {syncLabel(lock.sync_status)}
                </Badge>
              </span>
              {shopName && (
                <span>
                  <span className="text-text-muted">Store </span>
                  <span className="font-semibold">{shopName}</span>
                </span>
              )}
              <span>
                <span className="text-text-muted">Product </span>
                <span className="font-semibold">/products/{lock.handle ?? '—'}</span>
              </span>
              {isFetching && (
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
        </div>
      </header>

      <div
        role="tablist"
        aria-label="Lock sections"
        className="border-border flex shrink-0 [scrollbar-width:none] gap-1 overflow-x-auto border-y px-2 sm:px-4 [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((item) => {
          const selected = item.id === tab
          return (
            <button
              key={item.id}
              id={`lock-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls="lock-tabpanel"
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
        id="lock-tabpanel"
        role="tabpanel"
        aria-labelledby={`lock-tab-${tab}`}
        className={`bg-surface p-3 sm:p-5 ${
          fillPage ? 'lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-y-auto' : ''
        }`}
      >
        <div className={`flex flex-col gap-4 ${fillPage ? 'lg:min-h-0 lg:flex-1' : ''}`}>
          {lock.sync_status === 'error' && (
            <FormMessage tone="error">
              {`This lock was saved but could not be sent to the store${lock.sync_error ? `: ${lock.sync_error}` : '.'} Use “Set up store” on the list to push it again.`}
            </FormMessage>
          )}
          {!hasKeys && lock.enabled && tab === 'overview' && (
            <FormMessage tone="info">
              This lock has no keys, so any signed-in customer can open the product.
            </FormMessage>
          )}

          {tab === 'overview' && (
            // Laid out like a product's Overview: the big picture on the left, the cards on the right.
            <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
              <div className={`${DETAIL_CARD} relative p-3`}>
                <LockImage src={lock.image_url} size="xl" />
                <Link
                  to={`/products/${encodeURIComponent(lock.product_id)}`}
                  className="border-border bg-bg text-text hover:border-accent absolute right-6 bottom-6 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[0.78rem] font-semibold no-underline shadow-sm transition-colors"
                >
                  <ExternalLinkIcon width={14} height={14} />
                  View product
                </Link>
              </div>

              <div className="flex min-w-0 flex-col gap-4">
                <DetailSection title="Protected product" icon={LockIcon}>
                  <div className="flex flex-col gap-5">
                    <FieldGrid>
                      <Field label="Product">{lock.title}</Field>
                      <Field label="Handle">{lock.handle}</Field>
                      <Field label="Product status">{lock.status}</Field>
                      <Field label="Customers with access">
                        {lock.customers_with_access != null
                          ? lock.customers_with_access.toLocaleString('en-GB')
                          : null}
                      </Field>
                      <Field label="Last updated">
                        {lock.updated_at ? formatDateTime(lock.updated_at) : null}
                      </Field>
                      <Field label="Last sent to Shopify">
                        {lock.last_pushed_at ? formatDateTime(lock.last_pushed_at) : null}
                      </Field>
                    </FieldGrid>
                    {/* The keys under the fields, drawn like a product's tags — with a pencil. */}
                    <LockKeysSection lock={lock} shop={shop} />
                  </div>
                </DetailSection>
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <>
              <DetailSection title="Settings" icon={SlidersIcon}>
                <p className="text-text-muted mb-3 text-[0.8rem]">
                  Double-click a value to change it.
                </p>
                <FieldGrid>
                  {flagField('enabled')}
                  {flagField('hide_from_nav')}
                  {flagField('hide_from_lists')}
                </FieldGrid>
              </DetailSection>
              <DetailSection
                title="Advanced settings"
                icon={SlidersIcon}
                defaultOpen={false}
                // Opened from Customer Access's warning: the manual locking setting is in here.
                forceOpen={showAdvanced}
              >
                <FieldGrid>
                  {flagField('manual_locking')}
                  {flagField('hide_from_sitemap')}
                  {flagField('noindex')}
                </FieldGrid>
              </DetailSection>
            </>
          )}

          {tab === 'access' && (
            <LockAccessTab
              lock={lock}
              shop={shop}
              onOpenSettings={() => {
                setShowAdvanced(true)
                setTab('settings')
              }}
            />
          )}
        </div>
      </div>
      {pending &&
        createPortal(
          <LockChangeConfirm
            pending={pending}
            shop={shop}
            onClose={() => setPending(null)}
          />,
          document.body,
        )}
    </article>
  )
}
