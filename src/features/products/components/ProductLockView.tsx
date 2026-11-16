import { useState, type ComponentType, type ReactNode } from 'react'
import { Badge } from '../../../components/ui/Badge.tsx'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import {
  DetailsHeader,
  HeaderChip,
  HeaderTile,
  StatusPill,
} from '../../../components/ui/DetailsHeader.tsx'
import { DETAIL_CARD, DetailSection } from '../../../components/ui/DetailSection.tsx'
import {
  ChevronRightIcon,
  ClockIcon,
  EyeIcon,
  GridIcon,
  LayersIcon,
  ListChecksIcon,
  LockIcon,
  ProductsIcon,
  SearchIcon,
  SlidersIcon,
  TagIcon,
  UsersIcon,
  type IconProps,
} from '../../../components/ui/icons.tsx'
import type { AccessLock } from '../../../lib/api/endpoints.ts'
import { formatDateTimeAmPm } from '../../../lib/format.ts'
import { useLockedProducts } from '../hooks/useLockedProducts.ts'
import { LockCustomerAccess } from './LockAccessPanel.tsx'
import { ProductImage } from './ProductImage.tsx'

type TabId = 'overview' | 'access'

const TABS: { id: TabId; label: string; icon: ComponentType<IconProps> }[] = [
  { id: 'overview', label: 'Overview', icon: GridIcon },
  { id: 'access', label: 'Customer Access', icon: UsersIcon },
]

// The lock list's own words for the store's state of a lock.
const SYNC_LABELS: Record<string, string> = {
  synced: 'Synced with Shopify',
  error: 'Needs attention',
}
const syncLabel = (status: string | null | undefined) =>
  SYNC_LABELS[status ?? ''] ?? 'Pending'

interface ProductLockViewProps {
  /** The lock as the list read it; it is replaced by the freshest copy as soon as there is one. */
  lock: AccessLock
  onBack: () => void
  /** The product's own details page. */
  onViewProduct: () => void
  /** The lock's page in Lock Management (the place to change a lock) — only when asked. */
  onOpenInLocks: () => void
}

/** One label / value line of the Product Details card. */
function FactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-text-muted shrink-0">{label}</dt>
      <dd className="m-0 min-w-0 text-right">{children}</dd>
    </div>
  )
}

/** A setting of the lock, shown (not changed here) as Yes or No. */
function FlagRow({
  icon: Icon,
  label,
  on,
}: {
  icon: ComponentType<IconProps>
  label: string
  on: boolean
}) {
  return (
    <div className="border-border flex items-center gap-3 border-b py-3 text-[0.9rem] last:border-b-0">
      <Icon width={18} height={18} className="text-text-muted shrink-0" />
      <span className="min-w-0 flex-1 font-medium">{label}</span>
      <span
        className={`text-[0.85rem] font-semibold ${on ? 'text-accent' : 'text-text-muted'}`}
      >
        {on ? 'Yes' : 'No'}
      </span>
    </div>
  )
}

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
    <section className={`${DETAIL_CARD} min-w-0 overflow-hidden`}>
      <div className="bg-accent-tint/60 border-border-strong flex items-center gap-3 border-b px-4 py-3">
        <Icon width={22} height={22} className="text-accent shrink-0" />
        <div className="min-w-0">
          <h3 className="m-0 text-[1rem] font-semibold">{title}</h3>
          <p className="text-text-muted m-0 text-[0.78rem]">{description}</p>
        </div>
      </div>
      <div className="px-4 py-1">{children}</div>
    </section>
  )
}

/**
 * A product's lock, opened from the lock icon in the products list. It takes the place of the list
 * **inside the Products page** (no navigation, no window) and is laid out like the product's and
 * the lock's own pages: the shared header (a tile, the name, Enabled / Synced pills, the figures,
 * **Back to list**), the tab strip and the same cards. **Overview** — the picture with a way to the
 * product, its details, the keys and the settings, as Yes / No — and **Customer Access**, the very
 * component Lock Management uses, so who can open the product is managed here too. Changing a
 * lock's settings is done in Lock Management; **Open in Lock Management** goes there when asked.
 */
export function ProductLockView({
  lock: initial,
  onBack,
  onViewProduct,
  onOpenInLocks,
}: ProductLockViewProps) {
  const [tab, setTab] = useState<TabId>('overview')
  // The list read this lock once; this keeps following it, so a key or a customer changed on the
  // Customer Access tab shows at once (the same cached read, refreshed by every lock write).
  const lockOf = useLockedProducts([{ handle: initial.handle ?? '', shop: initial.shop }])
  const lock = lockOf({ handle: initial.handle ?? '', shop: initial.shop }) ?? initial
  const shop = lock.shop?.key ?? ''
  const handle = lock.handle ?? lock.product_id

  return (
    <article
      // From `lg` the view fills the window and the page does not scroll as a whole: the header
      // and the tabs stay put and the tab's content scrolls inside its own box.
      className="border-border bg-bg overflow-hidden rounded-2xl border lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
    >
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
            <StatusPill
              label={lock.enabled ? 'Enabled' : 'Disabled'}
              tone={lock.enabled ? 'success' : 'neutral'}
            />
            <span title={lock.sync_error ?? undefined}>
              <StatusPill
                label={syncLabel(lock.sync_status)}
                tone={
                  lock.sync_status === 'synced'
                    ? 'success'
                    : lock.sync_status === 'error'
                      ? 'danger'
                      : 'warning'
                }
              />
            </span>
          </>
        }
        chips={
          <>
            <HeaderChip icon={UsersIcon} label="Customers with access">
              <span className="font-semibold">
                {lock.customers_with_access != null
                  ? lock.customers_with_access.toLocaleString('en-GB')
                  : '—'}
              </span>{' '}
              <span className="text-text-muted">with access</span>
            </HeaderChip>
            <HeaderChip icon={TagIcon} label="Keys">
              <span className="font-semibold">{lock.tags.length}</span>{' '}
              <span className="text-text-muted">
                {lock.tags.length === 1 ? 'key' : 'keys'}
              </span>
            </HeaderChip>
            <HeaderChip icon={ClockIcon} label="Updated date">
              <span aria-hidden="true" className="text-text-muted">
                Updated Date:
              </span>{' '}
              {lock.updated_at ? formatDateTimeAmPm(lock.updated_at) : '—'}
            </HeaderChip>
          </>
        }
        actions={
          <button
            type="button"
            onClick={onOpenInLocks}
            aria-label="Open in Lock Management"
            className="border-border bg-bg text-text hover:border-accent flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-[0.85rem] font-semibold transition-colors"
          >
            <span className="hidden sm:inline" aria-hidden="true">
              Open in Lock Management
            </span>
            <ChevronRightIcon width={16} height={16} aria-hidden="true" />
          </button>
        }
        onBack={onBack}
      />

      <div
        role="tablist"
        aria-label="Lock sections"
        className="border-border mx-4 flex shrink-0 [scrollbar-width:none] gap-1 overflow-x-auto border-b sm:mx-5 [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((item) => {
          const selected = item.id === tab
          return (
            <button
              key={item.id}
              id={`product-lock-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls="product-lock-tabpanel"
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
        id="product-lock-tabpanel"
        role="tabpanel"
        aria-labelledby={`product-lock-tab-${tab}`}
        className="flex flex-col gap-3 p-4 sm:p-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
      >
        {tab === 'overview' && (
          <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
            <aside className="flex min-w-0 flex-col gap-4">
              <div
                className={`${DETAIL_CARD} relative overflow-hidden p-0 [&_img]:rounded-none [&_img]:border-0 [&_span]:rounded-none [&_span]:border-0`}
              >
                <ProductImage
                  src={lock.image_url ?? null}
                  alt={lock.title}
                  size="xl"
                  productId={lock.product_id}
                />
                <button
                  type="button"
                  onClick={onViewProduct}
                  className="bg-bg text-text hover:text-accent absolute bottom-3 left-1/2 flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full border-none px-4 py-1.5 text-[0.82rem] font-semibold whitespace-nowrap shadow-md transition-colors"
                >
                  <EyeIcon width={16} height={16} />
                  View Product
                </button>
              </div>

              <DetailSection title="Product Details" icon={ProductsIcon} compact>
                <dl className="m-0 flex flex-col gap-2.5 text-[0.85rem]">
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
                  <FactRow label="Handle">
                    <span className="flex items-center justify-end gap-1.5">
                      <span className="font-semibold break-all">{handle}</span>
                      <CopyButton value={handle} label="Copy handle" />
                    </span>
                  </FactRow>
                  {lock.shop?.name && (
                    <FactRow label="Store">
                      <span className="font-semibold">{lock.shop.name}</span>
                    </FactRow>
                  )}
                  <FactRow label="Status">
                    <Badge tone="neutral">{lock.status ?? '—'}</Badge>
                  </FactRow>
                  <FactRow label="Last sent to Shopify">
                    <span className="font-semibold">
                      {lock.last_pushed_at
                        ? formatDateTimeAmPm(lock.last_pushed_at)
                        : '—'}
                    </span>
                  </FactRow>
                </dl>
              </DetailSection>
            </aside>

            <div className="flex min-w-0 flex-col gap-4">
              <section aria-label="Keys" className={`${DETAIL_CARD} p-3`}>
                <h3 className="m-0 mb-2 flex items-center gap-2 text-[0.95rem] font-semibold">
                  <TagIcon width={18} height={18} className="text-accent" />
                  Keys (tags)
                </h3>
                {lock.tags.length === 0 ? (
                  <p className="text-text-muted m-0 text-[0.85rem]">
                    No keys: every customer who is signed in can open this product.
                  </p>
                ) : (
                  <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                    {lock.tags.map((tag) => (
                      <li
                        key={tag}
                        className="border-border bg-surface rounded-full border px-3 py-1 text-[0.8rem] font-semibold"
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <div className="grid items-start gap-4 xl:grid-cols-2">
                <SettingsCard
                  icon={EyeIcon}
                  title="Access & Visibility"
                  description="Who can access the product and where it is visible."
                >
                  <FlagRow
                    icon={ListChecksIcon}
                    label="Hidden from navigation menus"
                    on={lock.hide_from_nav}
                  />
                  <FlagRow
                    icon={ListChecksIcon}
                    label="Hidden from lists"
                    on={lock.hide_from_lists}
                  />
                </SettingsCard>
                <SettingsCard
                  icon={SlidersIcon}
                  title="Advanced Settings"
                  description="Extra lock options and indexing behavior."
                >
                  <FlagRow
                    icon={LockIcon}
                    label="Manual locking"
                    on={lock.manual_locking}
                  />
                  <FlagRow
                    icon={LayersIcon}
                    label="Hidden from sitemaps"
                    on={lock.hide_from_sitemap}
                  />
                  <FlagRow
                    icon={SearchIcon}
                    label="Search engines told not to index"
                    on={lock.noindex}
                  />
                </SettingsCard>
              </div>

              {lock.message && (
                <section
                  aria-label="Access-denied message"
                  className={`${DETAIL_CARD} p-3`}
                >
                  <h3 className="m-0 mb-1 text-[0.95rem] font-semibold">
                    Access-denied message
                  </h3>
                  <p className="m-0 text-[0.88rem] break-words whitespace-pre-wrap">
                    {lock.message}
                  </p>
                </section>
              )}
            </div>
          </div>
        )}

        {tab === 'access' && <LockCustomerAccess lock={lock} shop={shop} />}
      </div>
    </article>
  )
}
