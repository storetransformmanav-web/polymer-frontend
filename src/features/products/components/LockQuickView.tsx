import type { ReactNode } from 'react'
import { Badge, type BadgeTone } from '../../../components/ui/Badge.tsx'
import { Button } from '../../../components/ui/Button.tsx'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { ChevronRightIcon, LockIcon } from '../../../components/ui/icons.tsx'
import { SidePanel } from '../../../components/ui/SidePanel.tsx'
import type { AccessLock } from '../../../lib/api/endpoints.ts'
import { formatDateTimeAmPm } from '../../../lib/format.ts'
import { ProductImage } from './ProductImage.tsx'

interface LockQuickViewProps {
  lock: AccessLock
  onClose: () => void
  /** Leaves the products page for the lock's own page in Lock Management (an explicit choice). */
  onOpenInLocks: () => void
}

// The lock list's own words for the store's state of a lock.
const SYNC_LABELS: Record<string, string> = {
  synced: 'Synced with Shopify',
  error: 'Needs attention',
}
const syncLabel = (status: string | null | undefined) =>
  SYNC_LABELS[status ?? ''] ?? 'Pending'
const syncTone = (status: string | null | undefined): BadgeTone =>
  status === 'synced' ? 'success' : status === 'error' ? 'danger' : 'warning'

const dateOrDash = (value: string | null | undefined) =>
  value ? formatDateTimeAmPm(value) : '—'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-border flex items-baseline justify-between gap-4 border-b py-2.5 text-[0.88rem] last:border-b-0">
      <dt className="text-text-muted shrink-0">{label}</dt>
      <dd className="m-0 min-w-0 text-right font-medium break-words">{children}</dd>
    </div>
  )
}

const yesNo = (value: boolean | null | undefined) => (value ? 'Yes' : 'No')

/**
 * The lock of a product, read-only, in a right-hand panel opened from the lock icon in the
 * products list — so the person sees who can open the product and what is hidden without leaving
 * the page they are on. Everything shown is in the lock row the list already holds (the locks of
 * the store, read once), so it opens with no request. Changing a lock is done in Lock Management:
 * "Open in Lock Management" goes there, only when asked.
 */
export function LockQuickView({ lock, onClose, onOpenInLocks }: LockQuickViewProps) {
  const handle = lock.handle ?? lock.product_id
  return (
    <SidePanel
      title="Lock details"
      label={`${lock.title} lock details`}
      onClose={onClose}
      footer={
        <Button type="button" className="w-full" onClick={onOpenInLocks}>
          Open in Lock Management <ChevronRightIcon />
        </Button>
      }
    >
      <div className="flex flex-col gap-5 p-5">
        <div className="flex items-start gap-3">
          <ProductImage src={lock.image_url ?? null} alt="" productId={lock.product_id} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h3 className="m-0 text-[1.05rem] leading-snug font-semibold">
              {lock.title}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={lock.enabled ? 'success' : 'neutral'}>
                {lock.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
              <Badge tone={syncTone(lock.sync_status)}>
                {syncLabel(lock.sync_status)}
              </Badge>
            </div>
            <span className="text-text-muted flex items-center gap-1 font-mono text-[0.8rem]">
              {handle}
              <CopyButton value={handle} label={`Copy ${handle}`} />
            </span>
          </div>
        </div>

        {lock.sync_status === 'error' && lock.sync_error && (
          <p className="bg-danger-bg text-danger m-0 rounded-lg px-3 py-2 text-[0.82rem]">
            {lock.sync_error}
          </p>
        )}

        <section aria-label="Keys">
          <h4 className="text-text-muted m-0 mb-2 text-[0.7rem] font-bold tracking-wide uppercase">
            Keys (tags)
          </h4>
          {lock.tags.length === 0 ? (
            <p className="text-text-muted m-0 text-[0.85rem]">
              No keys: every customer who is signed in can open this product.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
              {lock.tags.map((tag) => (
                <li
                  key={tag}
                  className="bg-accent-tint text-accent flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                >
                  <LockIcon width={11} height={11} aria-hidden="true" />
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </section>

        <dl className="border-border m-0 rounded-xl border px-4">
          <Row label="Customers with access">
            {(lock.customers_with_access ?? 0).toLocaleString('en-GB')}
          </Row>
          <Row label="Store">{lock.shop?.name ?? '—'}</Row>
          <Row label="Product status">{lock.status ?? '—'}</Row>
          <Row label="Updated">{dateOrDash(lock.updated_at)}</Row>
          <Row label="Last sent to Shopify">{dateOrDash(lock.last_pushed_at)}</Row>
        </dl>

        <section aria-label="Visibility settings">
          <h4 className="text-text-muted m-0 mb-2 text-[0.7rem] font-bold tracking-wide uppercase">
            Visibility settings
          </h4>
          <dl className="border-border m-0 rounded-xl border px-4">
            <Row label="Hidden from navigation menus">{yesNo(lock.hide_from_nav)}</Row>
            <Row label="Hidden from lists">{yesNo(lock.hide_from_lists)}</Row>
            <Row label="Hidden from sitemaps">{yesNo(lock.hide_from_sitemap)}</Row>
            <Row label="Search engines told not to index">{yesNo(lock.noindex)}</Row>
            <Row label="Manual locking">{yesNo(lock.manual_locking)}</Row>
          </dl>
        </section>

        {lock.message && (
          <section aria-label="Access-denied message">
            <h4 className="text-text-muted m-0 mb-2 text-[0.7rem] font-bold tracking-wide uppercase">
              Access-denied message
            </h4>
            <p className="m-0 text-[0.88rem] break-words whitespace-pre-wrap">
              {lock.message}
            </p>
          </section>
        )}
      </div>
    </SidePanel>
  )
}
