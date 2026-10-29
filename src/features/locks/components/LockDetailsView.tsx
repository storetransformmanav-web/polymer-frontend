import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge.tsx'
import {
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
  InfoIcon,
  LockIcon,
  SearchIcon,
  SlidersIcon,
  SpinnerIcon,
  TagIcon,
} from '../../../components/ui/icons.tsx'
import type { AccessLock } from '../../../lib/api/endpoints.ts'
import { formatDateTime } from '../../../lib/format.ts'
import { useAccessCheck } from '../hooks/useLockWrites.ts'
import { checkReasonText, syncLabel, syncTone } from '../utils/format.ts'
import { LockImage } from './LockCard.tsx'

const BUTTON =
  'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'
const SECONDARY = `${BUTTON} border-border bg-bg text-text hover:border-accent`

/** A tag chip: the same pill as a product's tags. */
const TAG_CHIP =
  'bg-surface text-text border-border rounded-md border px-2.5 py-1 text-[0.8rem] font-medium'

type TabId = 'overview' | 'settings' | 'access'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'settings', label: 'Settings' },
  { id: 'access', label: 'Check access' },
]

const yesNo = (value: boolean) => (value ? 'Yes' : 'No')

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

/** "Would a customer see this product?": type an email (or id) and the backend says why. */
function CheckAccessCard({ lock, shop }: { lock: AccessLock; shop: string }) {
  const [customer, setCustomer] = useState('')
  const { check, result, isChecking, error, reset } = useAccessCheck()

  return (
    <DetailSection title="Check access" icon={SearchIcon}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          const who = customer.trim()
          if (who) check({ shop, customer: who, product: lock.product_id })
        }}
        className="flex flex-col gap-3"
      >
        <p className="text-text-muted text-[0.82rem]">
          Would a customer see this product? Type their email address (or id) to find out.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            aria-label="Customer email or id"
            placeholder="buyer@example.com"
            maxLength={200}
            value={customer}
            onChange={(event) => {
              setCustomer(event.target.value)
              reset()
            }}
            className="border-border bg-surface text-text placeholder:text-text-muted focus:border-accent focus:outline-accent-tint h-10 min-w-0 flex-1 rounded-lg border px-3 text-[0.88rem] outline-none focus:outline-2"
          />
          <button
            type="submit"
            disabled={isChecking || !customer.trim()}
            className={SECONDARY}
          >
            {isChecking && (
              <SpinnerIcon width={16} height={16} className="animate-spin" />
            )}
            Check
          </button>
        </div>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        {result && (
          <div
            role="status"
            className={`flex flex-col gap-1 rounded-lg px-3 py-2.5 text-[0.85rem] ${result.allowed ? 'bg-accent-tint text-accent' : 'bg-danger-bg text-danger'}`}
          >
            <strong>{result.allowed ? 'Allowed' : 'Not allowed'}</strong>
            <span>{checkReasonText(result.reason)}</span>
            {result.matched_tags.length > 0 && (
              <span>Matching tags: {result.matched_tags.join(', ')}</span>
            )}
          </div>
        )}
      </form>
    </DetailSection>
  )
}

/**
 * One lock's page, in place of the list — laid out like a product's page: a header (picture,
 * name, status pills, Back to list), a row of tabs and collapsible cards. **It is read-only**:
 * the keys, settings and message are only shown. The one thing it asks the backend is
 * "Check access" (`GET /access/check`), which changes nothing; a lock is created from Add lock.
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

  return (
    <article className="border-border bg-bg overflow-hidden rounded-2xl border">
      <header className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <LockImage src={lock.image_url} size="lg" />
          <div className="min-w-0 flex-1">
            <h1
              className="text-lg leading-snug font-bold break-words sm:text-2xl"
              title={lock.title}
            >
              {lock.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.85rem]">
              <Badge tone={lock.enabled ? 'success' : 'neutral'}>
                <span
                  aria-hidden="true"
                  className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current"
                />
                {lock.enabled ? 'Active' : 'Disabled'}
              </Badge>
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
        className="border-border flex [scrollbar-width:none] gap-1 overflow-x-auto border-y px-2 sm:px-4 [&::-webkit-scrollbar]:hidden"
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
        className="bg-surface p-3 sm:p-5"
      >
        <div className="flex flex-col gap-4">
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
            <>
              <DetailSection title="Protected product" icon={LockIcon}>
                <FieldGrid>
                  <Field label="Product">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {lock.title}
                      <Link
                        to={`/products/${encodeURIComponent(lock.product_id)}`}
                        className="text-accent inline-flex items-center gap-1 text-[0.82rem] font-semibold no-underline hover:underline"
                      >
                        <ExternalLinkIcon width={14} height={14} />
                        View product
                      </Link>
                    </span>
                  </Field>
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
              </DetailSection>

              <DetailSection title="Keys (tags)" icon={TagIcon} count={lock.tags.length}>
                {hasKeys ? (
                  <ul aria-label="Keys" className="flex flex-wrap gap-2">
                    {lock.tags.map((tag) => (
                      <li key={tag} className={TAG_CHIP}>
                        {tag}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-text-muted text-[0.9rem]">
                    No keys: any signed-in customer can open this product.
                  </p>
                )}
              </DetailSection>

              <DetailSection title="Message" icon={InfoIcon}>
                <p className="text-text-muted mb-2 text-[0.8rem]">
                  Shown to a customer who does not have access.
                </p>
                {lock.message?.trim() ? (
                  <p className="text-[0.9rem] break-words whitespace-pre-wrap">
                    {lock.message}
                  </p>
                ) : (
                  <p className="text-text-muted text-[0.9rem]">
                    The store’s default message.
                  </p>
                )}
              </DetailSection>
            </>
          )}

          {tab === 'settings' && (
            <>
              <DetailSection title="Settings" icon={SlidersIcon}>
                <FieldGrid>
                  <Field label="Lock">{lock.enabled ? 'Enabled' : 'Disabled'}</Field>
                  <Field label="Hidden from navigation menus">
                    {yesNo(lock.hide_from_nav)}
                  </Field>
                  <Field label="Hidden from lists">{yesNo(lock.hide_from_lists)}</Field>
                </FieldGrid>
              </DetailSection>
              <DetailSection
                title="Advanced settings"
                icon={SlidersIcon}
                defaultOpen={false}
              >
                <FieldGrid>
                  <Field label="Manual locking">{yesNo(lock.manual_locking)}</Field>
                  <Field label="Hidden from sitemaps">
                    {yesNo(lock.hide_from_sitemap)}
                  </Field>
                  <Field label="Search engines told not to index">
                    {yesNo(lock.noindex)}
                  </Field>
                </FieldGrid>
              </DetailSection>
            </>
          )}

          {tab === 'access' && <CheckAccessCard lock={lock} shop={shop} />}
        </div>
      </div>
    </article>
  )
}
