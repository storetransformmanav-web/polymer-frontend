import { useState, type ComponentType, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge.tsx'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { DETAIL_CARD, DetailSkeleton } from '../../../components/ui/DetailSection.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { IconAction } from '../../../components/ui/IconAction.tsx'
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
  CheckIcon,
  ClockIcon,
  EyeIcon,
  ExternalLinkIcon,
  InfoIcon,
  GridIcon,
  type IconProps,
  LockIcon,
  SlidersIcon,
  TagIcon,
  UsersIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import type { AccessLock } from '../../../lib/api/endpoints.ts'
import { formatDateTime } from '../../../lib/format.ts'
import { useLinkedState } from '../../../hooks/useLinkedState.ts'
import { safeUrl } from '../../../lib/safeUrl.ts'
import { ProductLightbox } from '../../products/index.ts'
import { linkedProductPath, syncLabel, syncTone } from '../utils/format.ts'
import {
  FLAG_INFO,
  flagWord,
  LOCK_FLAGS,
  type LockFlag,
  type LockOptionChange,
} from '../utils/lockOptions.ts'
import { LockChangeConfirm, type PendingLockChange } from './LockChangeConfirm.tsx'
import { LockKeysSection } from './LockAccessEditors.tsx'
import { LockImage } from './LockCard.tsx'
import { LockAccessTab } from './LockAccessTab.tsx'
import { PillSelect, type PillOption } from '../../../components/ui/PillSelect.tsx'
import { ConfirmCancelDialog } from '../../../components/ui/ConfirmCancelDialog.tsx'

const BUTTON =
  'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'
const SECONDARY = `${BUTTON} border-border bg-bg text-text hover:border-accent`

const STATUS_OPTIONS: PillOption[] = [
  { value: 'active', label: flagWord('enabled', true), tone: 'success' },
  { value: 'inactive', label: flagWord('enabled', false), tone: 'neutral' },
]

type TabId = 'overview' | 'access'

const TABS: { id: TabId; label: string; icon: ComponentType<IconProps> }[] = [
  { id: 'overview', label: 'Overview', icon: GridIcon },
  { id: 'access', label: 'Customer Access', icon: UsersIcon },
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
 * One lock's page, in place of the list. A side column (the picture, whether the lock is in force,
 * Quick info and a way to the product's page) beside the header (name, the Enabled / Disabled
 * dropdown, the sync state, the handle, the figures) and two tabs: **Overview** — the settings
 * (hidden from menus / lists / sitemaps, no-index, manual locking) as switches. The status and the
 * switches only change the page: a bar then offers **Save changes** and **Cancel**, and Save asks
 * once for everything ("Are you sure?", `LockChangeConfirm`, one `POST /access/locks`) — and the lock's keys
 * (the tags that give access) with a pencil (`LockAccessEditors.tsx`, `PUT /access/tags`) — and
 * **Customer Access**. Every fact appears once on the page: the status in the header, the handle
 * and last-updated time in the header, the rest in Quick info.
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
  const linkedState = useLinkedState()
  const [tab, setTab] = useState<TabId>('overview')
  const fillPage = tab === 'access'
  // The settings changed on the page and not saved yet (only those that differ count).
  const [draft, setDraft] = useState<LockOptionChange>({})
  // The changes being saved, waiting for "Yes, update".
  const [pending, setPending] = useState<PendingLockChange | null>(null)
  // Leaving with unsaved changes: asked first.
  const [leaving, setLeaving] = useState(false)
  // The picture is open in the lightbox.
  const [viewing, setViewing] = useState(false)

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

  /** A setting as it shows on the page: the change waiting to be saved, else the lock's own. */
  const valueOf = (flag: LockFlag) => draft[flag] ?? lock[flag]
  const setFlag = (flag: LockFlag, value: boolean) =>
    setDraft((current) => ({ ...current, [flag]: value }))
  const changed = LOCK_FLAGS.filter(
    (flag) => draft[flag] !== undefined && draft[flag] !== lock[flag],
  )
  const dirty = changed.length > 0

  function save() {
    if (!lock || !dirty) return
    setPending({
      lock,
      change: Object.fromEntries(changed.map((flag) => [flag, draft[flag]])),
      lines: changed.map((flag) => ({
        label: FLAG_INFO[flag].label,
        from: flagWord(flag, lock[flag]),
        to: flagWord(flag, !lock[flag]),
      })),
    })
  }

  const back = () => (dirty ? setLeaving(true) : onBack())

  /** A yes/no setting as a switch: flipping it only changes the page, until Save changes. */
  function flagField(flag: LockFlag) {
    const info = FLAG_INFO[flag]
    const value = valueOf(flag)
    return (
      <div className="flex min-w-0 flex-col gap-2">
        <p className="m-0 flex items-center gap-2 text-[0.85rem] font-semibold">
          {info.label}
          <span title={info.hint} className="text-text-muted inline-flex">
            <InfoIcon width={15} height={15} />
          </span>
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={value}
            aria-label={info.label}
            onClick={() => setFlag(flag, !value)}
            className={`focus-visible:outline-accent relative h-6 w-11 shrink-0 cursor-pointer rounded-full border-none transition-colors focus-visible:outline-2 ${
              value ? 'bg-accent' : 'bg-border-strong'
            }`}
          >
            <span
              aria-hidden="true"
              className={`bg-bg absolute top-0.5 left-0.5 h-5 w-5 rounded-full shadow-sm transition-transform ${
                value ? 'translate-x-5' : ''
              }`}
            />
          </button>
          <span className="text-[0.85rem]">{flagWord(flag, value)}</span>
          {changed.includes(flag) && (
            <Badge tone="warning" className="text-[0.7rem]">
              Not saved
            </Badge>
          )}
        </div>
      </div>
    )
  }

  const handle = lock.handle ?? null
  const pictureUrl = safeUrl(lock.image_url)

  return (
    <article
      // Customer Access fills the height of the page (its table scrolls in its own box), so the
      // page itself does not scroll; the Overview is as tall as its content.
      className={`border-border bg-bg overflow-hidden rounded-2xl border ${
        fillPage ? 'lg:flex lg:min-h-0 lg:flex-1 lg:flex-col' : 'shrink-0'
      }`}
    >
      <header className="border-border mx-4 mt-4 flex shrink-0 flex-col gap-2 border-b pb-3 sm:mx-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1
            className="min-w-0 text-lg leading-snug font-bold break-words sm:text-2xl"
            title={lock.title}
          >
            {lock.title}
          </h1>
          {/* Enabled / Disabled — changed here with a dropdown, saved with the other settings. */}
          <PillSelect
            label={`Status of ${lock.title}: ${flagWord('enabled', valueOf('enabled'))}`}
            menuLabel={`Status of ${lock.title}`}
            options={STATUS_OPTIONS}
            value={valueOf('enabled') ? 'active' : 'inactive'}
            onChange={(next) => setFlag('enabled', next === 'active')}
          />
          {changed.includes('enabled') && (
            <Badge tone="warning" className="text-[0.7rem]">
              Not saved
            </Badge>
          )}
          <span title={lock.sync_error ?? undefined}>
            <Badge tone={syncTone(lock.sync_status)} className="gap-1.5 py-1">
              {lock.sync_status === 'synced' && (
                <CheckCircleIcon width={14} height={14} />
              )}
              {lock.sync_status === 'synced'
                ? 'Synced with Shopify'
                : syncLabel(lock.sync_status)}
            </Badge>
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            {dirty && (
              // Save / Discard sit beside Back to list, as on a product's page.
              <div
                role="region"
                aria-label="Unsaved changes"
                className="flex items-center gap-3"
              >
                <p className="text-text-muted m-0 hidden text-[0.8rem] font-semibold sm:block">
                  {changed.length === 1
                    ? '1 unsaved change'
                    : `${changed.length} unsaved changes`}
                </p>
                <div className="flex items-center gap-1.5">
                  <IconAction
                    label="Save"
                    accessibleLabel="Save changes"
                    icon={CheckIcon}
                    tone="primary"
                    onClick={save}
                  />
                  <IconAction
                    label="Discard"
                    accessibleLabel="Cancel"
                    icon={XIcon}
                    onClick={() => setDraft({})}
                  />
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={back}
              aria-label="Back to list"
              className="border-border bg-bg text-text hover:border-accent flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[0.82rem] font-semibold transition-colors"
            >
              <ArrowLeftIcon width={16} height={16} />
              <span className="hidden sm:inline" aria-hidden="true">
                Back to list
              </span>
            </button>
          </div>
        </div>
        <div className="text-text-muted flex flex-wrap items-center gap-x-2 text-[0.85rem]">
          <span className="font-medium">/products/{handle ?? '—'}</span>
          {handle && <CopyButton value={handle} label="Copy product handle" />}
          {isFetching && (
            <span className="text-[0.75rem]" role="status">
              Updating…
            </span>
          )}
        </div>
        <dl className="m-0 flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.85rem]">
          <div className="flex items-center gap-2">
            <dt className="sr-only">Customers with access</dt>
            <dd className="m-0 flex items-center gap-2 whitespace-nowrap">
              <UsersIcon width={18} height={18} className="text-accent shrink-0" />
              <span className="font-semibold">
                {lock.customers_with_access != null
                  ? lock.customers_with_access.toLocaleString('en-GB')
                  : '—'}
              </span>
              <span className="text-text-muted">with access</span>
            </dd>
          </div>
          <div className="border-border flex items-center gap-2 sm:border-l sm:pl-6">
            <dt className="sr-only">Keys</dt>
            <dd className="m-0 flex items-center gap-2 whitespace-nowrap">
              <TagIcon width={18} height={18} className="text-text-muted shrink-0" />
              <span className="font-semibold">{lock.tags.length}</span>
              <span className="text-text-muted">
                {lock.tags.length === 1 ? 'key' : 'keys'}
              </span>
            </dd>
          </div>
          <div className="border-border flex items-center gap-2 sm:border-l sm:pl-6">
            <dt className="text-text-muted flex items-center gap-2">
              <ClockIcon width={16} height={16} className="shrink-0" />
              Last updated
            </dt>
            <dd className="m-0 font-semibold whitespace-nowrap">
              {lock.updated_at ? formatDateTime(lock.updated_at) : '—'}
            </dd>
          </div>
        </dl>
      </header>

      <div
        className={`flex flex-col gap-4 p-4 sm:p-5 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-x-4 ${
          fillPage ? 'lg:min-h-0 lg:flex-1 lg:items-stretch' : ''
        }`}
      >
        {/* The side column: the picture (it opens full size) and the product's facts. Each fact
            is shown once on the page. */}
        <aside
          className={`flex min-w-0 flex-col gap-3 ${fillPage ? 'lg:min-h-0 lg:overflow-y-auto' : ''}`}
        >
          <div
            // The picture sits in its own card, with no second frame around it.
            className={`${DETAIL_CARD} overflow-hidden p-0 [&_img]:rounded-none [&_img]:border-0 [&_span]:rounded-none [&_span]:border-0`}
          >
            {pictureUrl ? (
              // The picture opens full size in the same viewer as a product's pictures.
              <button
                type="button"
                onClick={() => setViewing(true)}
                aria-label={`View picture of ${lock.title}`}
                title="View picture"
                className="focus-visible:outline-accent block w-full cursor-zoom-in border-none bg-transparent p-0 focus-visible:outline-2"
              >
                <LockImage src={lock.image_url} size="xl" />
              </button>
            ) : (
              <LockImage src={lock.image_url} size="xl" />
            )}
          </div>

          <section className={`${DETAIL_CARD} overflow-hidden`}>
            <h2 className="bg-accent-tint/60 text-accent border-border-strong m-0 border-b px-4 py-3 text-[0.95rem] font-bold">
              Quick info
            </h2>
            <div className="flex flex-col gap-3 p-4">
              <dl className="m-0 flex flex-col gap-2.5 text-[0.82rem]">
                <FactRow label="Product ID">
                  <span className="flex items-center justify-end gap-1.5">
                    <span className="font-semibold break-all">
                      {lock.shopify_id ?? lock.product_id}
                    </span>
                    <CopyButton
                      value={String(lock.shopify_id ?? lock.product_id)}
                      label="Copy product ID"
                    />
                  </span>
                </FactRow>
                {shopName && (
                  <FactRow label="Store">
                    <span className="font-semibold">{shopName}</span>
                  </FactRow>
                )}
                <FactRow label="Product status">
                  <Badge tone="neutral" className="tracking-wide uppercase">
                    {lock.status ?? '—'}
                  </Badge>
                </FactRow>
              </dl>
              <Link
                to={linkedProductPath(lock.product_id)}
                state={linkedState(lock.title)}
                className="border-border bg-bg text-text hover:border-accent flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[0.82rem] font-semibold no-underline transition-colors"
              >
                <EyeIcon width={16} height={16} />
                View product
                <ExternalLinkIcon width={14} height={14} />
              </Link>
            </div>
          </section>
        </aside>

        <div className={`flex min-w-0 flex-col ${fillPage ? 'lg:min-h-0' : ''}`}>
          <div
            role="tablist"
            aria-label="Lock sections"
            className="border-border flex shrink-0 [scrollbar-width:none] gap-1 overflow-x-auto border-b [&::-webkit-scrollbar]:hidden"
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
                  className={`-mb-px flex shrink-0 cursor-pointer items-center gap-2 border-0 border-b-2 bg-transparent px-4 py-3 text-[0.88rem] font-semibold whitespace-nowrap transition-colors ${
                    selected
                      ? 'border-accent text-accent'
                      : 'text-text-muted hover:text-text border-transparent'
                  }`}
                >
                  <item.icon width={17} height={17} />
                  {item.label}
                </button>
              )
            })}
          </div>

          <div
            id="lock-tabpanel"
            role="tabpanel"
            aria-labelledby={`lock-tab-${tab}`}
            className={`pt-3 ${
              fillPage
                ? 'lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-y-auto'
                : ''
            }`}
          >
            <div
              className={`flex flex-col gap-3 ${fillPage ? 'lg:min-h-0 lg:flex-1' : ''}`}
            >
              {lock.sync_status === 'error' && (
                <FormMessage tone="error">
                  {`This lock was saved but could not be sent to the store${lock.sync_error ? `: ${lock.sync_error}` : '.'} Use “Set up store” on the list to push it again.`}
                </FormMessage>
              )}

              {tab === 'overview' && (
                // Three cards: the keys (the tags that give access, with a pencil), then the
                // settings. Status is the header's dropdown, so it is not repeated here.
                <>
                  <div className={`${DETAIL_CARD} p-3`}>
                    <LockKeysSection lock={lock} shop={shop} />
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <SettingsCard
                      icon={LockIcon}
                      title="Access & visibility"
                      description="Who can access the product and where it is visible."
                    >
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        {flagField('hide_from_nav')}
                        {flagField('hide_from_lists')}
                      </div>
                    </SettingsCard>
                    <SettingsCard
                      icon={SlidersIcon}
                      title="Advanced settings"
                      description="Extra lock options and indexing behavior."
                    >
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 xl:grid-cols-3">
                        {flagField('manual_locking')}
                        {flagField('hide_from_sitemap')}
                        {flagField('noindex')}
                      </div>
                    </SettingsCard>
                  </div>
                </>
              )}

              {tab === 'access' && <LockAccessTab lock={lock} shop={shop} />}
            </div>
          </div>
        </div>
      </div>
      {pictureUrl && (
        <ProductLightbox
          slides={[{ src: pictureUrl, alt: lock.title }]}
          index={viewing ? 0 : null}
          onClose={() => setViewing(false)}
        />
      )}
      {pending &&
        createPortal(
          <LockChangeConfirm
            pending={pending}
            shop={shop}
            onClose={() => setPending(null)}
            onSaved={() => setDraft({})}
          />,
          document.body,
        )}
      {leaving && (
        <ConfirmCancelDialog
          title="Discard your changes?"
          question=""
          detail="The settings you changed on this lock have not been saved."
          keepLabel="Keep editing"
          confirmLabel="Yes, discard"
          onConfirm={() => {
            setLeaving(false)
            setDraft({})
            onBack()
          }}
          onKeep={() => setLeaving(false)}
        />
      )}
    </article>
  )
}

/** A settings card: a tinted header (icon tile, title, one line about it) over its fields. */
function SettingsCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: ComponentType<IconProps>
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className={`${DETAIL_CARD} overflow-hidden`}>
      <div className="bg-accent-tint/60 border-border-strong flex items-center gap-2.5 border-b px-4 py-2">
        <span className="bg-accent-tint text-accent border-accent/20 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border">
          <Icon width={18} height={18} />
        </span>
        <div className="min-w-0">
          <h3 className="m-0 text-[0.95rem] font-semibold">{title}</h3>
          <p className="text-text-muted m-0 text-[0.78rem]">{description}</p>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

/** One label / value line of the Quick info card. */
function FactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-text-muted shrink-0">{label}</dt>
      <dd className="m-0 min-w-0 text-right">{children}</dd>
    </div>
  )
}
