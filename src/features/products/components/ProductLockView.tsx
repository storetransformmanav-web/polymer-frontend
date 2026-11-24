import { useState } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import {
  DETAIL_CARD,
  DetailSection,
  Field,
  FieldGrid,
} from '../../../components/ui/DetailSection.tsx'
import {
  DetailsHeader,
  HeaderChip,
  HeaderTile,
} from '../../../components/ui/DetailsHeader.tsx'
import {
  ClockIcon,
  ExternalLinkIcon,
  EyeIcon,
  GridIcon,
  ImageIcon,
  LayersIcon,
  ListChecksIcon,
  LockIcon,
  ProductsIcon,
  SearchIcon,
  SlidersIcon,
  StoreIcon,
  TagIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import type { AccessLock } from '../../../lib/api/endpoints.ts'
import { formatDateTimeAmPm } from '../../../lib/format.ts'
import { safeUrl } from '../../../lib/safeUrl.ts'
import { LockCustomerAccess } from './LockAccessPanel.tsx'

type TabId = 'overview' | 'access'

interface ProductLockViewProps {
  lock: AccessLock
  onBack: () => void
  onViewProduct: () => void
  onOpenInLocks: () => void
}

const TABS: { id: TabId; label: string; icon: typeof GridIcon }[] = [
  { id: 'overview', label: 'Overview', icon: GridIcon },
  { id: 'access', label: 'Customer Access', icon: UsersIcon },
]

const FACTS = [
  { name: 'hide_from_lists', label: 'Hidden from lists', icon: ListChecksIcon },
  { name: 'hide_from_nav', label: 'Hidden from navigation menus', icon: ListChecksIcon },
  { name: 'manual_locking', label: 'Manual locking', icon: LockIcon },
  { name: 'hide_from_sitemap', label: 'Hidden from sitemaps', icon: LayersIcon },
  { name: 'noindex', label: 'Search engines told not to index', icon: SearchIcon },
] as const

export function ProductLockView({
  lock,
  onBack,
  onViewProduct,
  onOpenInLocks,
}: ProductLockViewProps) {
  const [tab, setTab] = useState<TabId>('overview')
  const pictureUrl = safeUrl(lock.image_url)
  const shop = lock.shop?.key ?? ''
  const shopName = lock.shop?.name ?? lock.shop?.domain

  return (
    <article className="border-border bg-bg overflow-hidden rounded-2xl border lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
      <DetailsHeader
        className="border-border mx-4 mt-4 shrink-0 border-b pb-3 sm:mx-5"
        visual={
          <HeaderTile>
            <LockIcon width={26} height={26} />
          </HeaderTile>
        }
        title={lock.title}
        titleHint={lock.title}
        status={
          <>
            <Badge tone={lock.enabled ? 'success' : 'neutral'}>
              {lock.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
            <Badge
              tone={
                lock.sync_status === 'synced'
                  ? 'success'
                  : lock.sync_status === 'error'
                    ? 'danger'
                    : 'warning'
              }
            >
              {lock.sync_status === 'synced'
                ? 'Synced with Shopify'
                : lock.sync_status === 'error'
                  ? 'Needs attention'
                  : 'Pending'}
            </Badge>
          </>
        }
        chips={
          <>
            <HeaderChip icon={UsersIcon} label="Customers with access">
              <strong>
                {lock.customers_with_access?.toLocaleString('en-GB') ?? '—'}
              </strong>{' '}
              <span className="text-text-muted">with access</span>
            </HeaderChip>
            <HeaderChip icon={TagIcon} label="Keys">
              <strong>{lock.tags.length}</strong>{' '}
              <span className="text-text-muted">
                {lock.tags.length === 1 ? 'key' : 'keys'}
              </span>
            </HeaderChip>
            <HeaderChip icon={ClockIcon} label="Updated date">
              {lock.updated_at ? formatDateTimeAmPm(lock.updated_at) : '—'}
            </HeaderChip>
          </>
        }
        actions={
          <button
            type="button"
            onClick={onOpenInLocks}
            className="border-border bg-bg text-text hover:border-accent flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-[0.85rem] font-semibold transition-colors"
          >
            Open in Lock Management
            <ExternalLinkIcon width={14} height={14} />
          </button>
        }
        onBack={onBack}
      />

      <div
        role="tablist"
        aria-label="Lock sections"
        className="border-border mx-4 flex shrink-0 gap-1 overflow-x-auto border-b sm:mx-5"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`product-lock-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls="product-lock-panel"
            onClick={() => setTab(id)}
            className={`-mb-px flex shrink-0 cursor-pointer items-center gap-2 border-0 border-b-2 bg-transparent px-4 py-3 text-[0.88rem] font-semibold whitespace-nowrap transition-colors ${
              tab === id
                ? 'border-accent text-accent'
                : 'text-text-muted hover:text-text border-transparent'
            }`}
          >
            <Icon width={17} height={17} />
            {label}
          </button>
        ))}
      </div>

      <div
        id="product-lock-panel"
        role="tabpanel"
        aria-labelledby={`product-lock-tab-${tab}`}
        className="flex flex-col gap-4 p-4 sm:p-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
      >
        {tab === 'overview' ? (
          <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
            <aside className="flex min-w-0 flex-col gap-4">
              <section className={`${DETAIL_CARD} relative overflow-hidden p-0`}>
                {pictureUrl ? (
                  <img
                    src={pictureUrl}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="border-border bg-surface aspect-square w-full rounded-xl border object-contain"
                  />
                ) : (
                  <div className="border-border bg-surface text-text-muted flex aspect-square w-full items-center justify-center rounded-xl border">
                    <ImageIcon width={56} height={56} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={onViewProduct}
                  className="bg-bg text-text hover:text-accent absolute bottom-3 left-1/2 flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full border-0 px-4 py-1.5 text-[0.82rem] font-semibold whitespace-nowrap shadow-md transition-colors"
                >
                  <EyeIcon width={16} height={16} />
                  View Product
                  <ExternalLinkIcon width={14} height={14} />
                </button>
              </section>

              <DetailSection title="Product Details" icon={ProductsIcon} compact>
                <FieldGrid>
                  <Field label="Product ID">
                    <span className="inline-flex items-center gap-1.5">
                      {lock.shopify_id ?? lock.product_id}
                      <CopyButton
                        value={String(lock.shopify_id ?? lock.product_id)}
                        label="Copy product ID"
                      />
                    </span>
                  </Field>
                  {shopName && (
                    <Field label="Store">
                      <span className="inline-flex items-center gap-1.5">
                        <StoreIcon width={15} height={15} />
                        {shopName}
                      </span>
                    </Field>
                  )}
                  <Field label="Product status">{lock.status ?? '—'}</Field>
                  <Field label="Handle">{lock.handle ?? '—'}</Field>
                  {lock.message && (
                    <Field label="Access denied message">{lock.message}</Field>
                  )}
                </FieldGrid>
              </DetailSection>
            </aside>

            <div className="flex min-w-0 flex-col gap-4">
              <DetailSection title="Keys (tags)" icon={TagIcon}>
                {lock.tags.length ? (
                  <div className="flex flex-wrap gap-2">
                    {lock.tags.map((tag) => (
                      <span
                        key={tag}
                        className="bg-accent-tint text-accent rounded-full px-3 py-1 text-[0.82rem] font-semibold"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-muted m-0 text-[0.85rem]">
                    No keys are required. Any signed-in customer can see this product.
                  </p>
                )}
              </DetailSection>

              <div className="grid items-start gap-4 xl:grid-cols-2">
                <DetailSection title="Access & Visibility" icon={EyeIcon}>
                  <LockSettings
                    lock={lock}
                    names={['hide_from_nav', 'hide_from_lists']}
                  />
                </DetailSection>
                <DetailSection title="Advanced Settings" icon={SlidersIcon}>
                  <LockSettings
                    lock={lock}
                    names={['manual_locking', 'hide_from_sitemap', 'noindex']}
                  />
                </DetailSection>
              </div>
            </div>
          </div>
        ) : (
          <LockCustomerAccess lock={lock} shop={shop} />
        )}
      </div>
    </article>
  )
}

function LockSettings({
  lock,
  names,
}: {
  lock: AccessLock
  names: readonly (typeof FACTS)[number]['name'][]
}) {
  return (
    <dl className="m-0">
      {FACTS.filter((fact) => names.includes(fact.name)).map(
        ({ name, label, icon: Icon }) => (
          <div
            key={name}
            className="border-border flex items-center gap-3 border-b py-2.5 last:border-b-0"
          >
            <Icon width={17} height={17} className="text-text-muted shrink-0" />
            <dt className="min-w-0 flex-1 text-[0.84rem] font-medium">{label}</dt>
            <dd className="m-0 shrink-0">
              <Badge tone={lock[name] ? 'success' : 'neutral'}>
                {lock[name] ? 'Yes' : 'No'}
              </Badge>
            </dd>
          </div>
        ),
      )}
    </dl>
  )
}
