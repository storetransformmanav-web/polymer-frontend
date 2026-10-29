import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge.tsx'
import { DETAIL_CARD, DetailSkeleton } from '../../../components/ui/DetailSection.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckIcon,
  ExternalLinkIcon,
  SpinnerIcon,
} from '../../../components/ui/icons.tsx'
import type { AccessLock } from '../../../lib/api/endpoints.ts'
import { formatDateTime } from '../../../lib/format.ts'
import {
  useAccessCheck,
  useSaveLock,
  useUpdateAccessTags,
} from '../hooks/useLockWrites.ts'
import { checkReasonText, syncLabel, syncTone } from '../utils/format.ts'
import { buildOptionsUpdate, optionsOf, type LockOptions } from '../utils/lockDraft.ts'
import { LockCard, LockImage } from './LockCard.tsx'
import { LockConfirmDialog } from './LockConfirmDialog.tsx'
import {
  LockAdvancedCard,
  LockMessageCard,
  LockSettingsCard,
} from './LockOptionCards.tsx'
import { TagPicker } from './TagPicker.tsx'

const BUTTON =
  'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-[0.85rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50'
const PRIMARY = `${BUTTON} bg-accent text-accent-contrast hover:bg-accent-hover border-none shadow-sm`
const SECONDARY = `${BUTTON} border-border bg-bg text-text hover:border-accent`

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
  /** A change was saved: what the backend says it did. */
  onNotice: (message: string) => void
}

/** What the "Check access" card asks: would this customer see this product? */
function CheckAccessCard({ lock, shop }: { lock: AccessLock; shop: string }) {
  const [customer, setCustomer] = useState('')
  const { check, result, isChecking, error, reset } = useAccessCheck()

  return (
    <LockCard
      title="Check access"
      description="Would a customer see this product? Type their email address (or id) to find out."
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          const who = customer.trim()
          if (who) check({ shop, customer: who, product: lock.product_id })
        }}
        className="flex flex-col gap-3"
      >
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
    </LockCard>
  )
}

/**
 * One lock's page, in place of the list — laid out like the Locksmith lock page: the protected
 * product, its keys (tags) and message on the left; the settings on the right. Tags are added
 * and removed straight away (after a confirmation); the settings and the message are saved
 * together with **Save changes**, which sends only what changed.
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
  onNotice,
}: LockDetailsViewProps) {
  // Only what was changed on this page; everything else is read from the lock itself.
  const [edits, setEdits] = useState<Partial<LockOptions>>({})
  const [saving, setSaving] = useState(false)
  const [tagChange, setTagChange] = useState<{
    kind: 'add' | 'remove'
    tags: string[]
  } | null>(null)
  const { save, clearError } = useSaveLock()
  const { update } = useUpdateAccessTags()

  if (error || notFound) {
    return (
      <section
        className={`${DETAIL_CARD} flex flex-col items-center gap-3 px-4 py-16 text-center`}
      >
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

  const options: LockOptions = { ...optionsOf(lock), ...edits }
  const body = buildOptionsUpdate(lock, options, shop)
  const hasKeys = lock.tags.length > 0
  const hidden = [
    lock.hide_from_lists ? 'lists' : null,
    lock.hide_from_nav ? 'menus' : null,
  ].filter(Boolean)

  const change = (patch: Partial<LockOptions>) =>
    setEdits((current) => ({ ...current, ...patch }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onBack} className={SECONDARY}>
          <ArrowLeftIcon width={16} height={16} />
          <span className="hidden sm:inline">Back to list</span>
        </button>
        <div className="min-w-0 flex-1">
          <h2
            className="truncate text-[1.35rem] leading-tight font-bold"
            title={lock.title}
          >
            {lock.title}
          </h2>
          <p className="text-text-muted text-[0.82rem]">
            Product at /products/{lock.handle ?? '—'} · {shopName}
            {isFetching && ' · Updating…'}
          </p>
        </div>
        <Badge tone={lock.enabled ? 'success' : 'neutral'}>
          {lock.enabled ? 'Active' : 'Disabled'}
        </Badge>
        <Badge tone={syncTone(lock.sync_status)}>{syncLabel(lock.sync_status)}</Badge>
        <button
          type="button"
          disabled={!body || saving}
          onClick={() => {
            clearError()
            setSaving(true)
          }}
          className={PRIMARY}
        >
          <CheckIcon width={16} height={16} />
          Save changes
        </button>
      </div>

      {lock.sync_status === 'error' && (
        <FormMessage tone="error">
          {`This lock was saved but could not be sent to the store${lock.sync_error ? `: ${lock.sync_error}` : '.'} Use “Set up store” on the list to push it again.`}
        </FormMessage>
      )}
      {!hasKeys && lock.enabled && (
        <FormMessage tone="info">
          This lock has no keys, so any signed-in customer can open the product. Add a tag
          below to limit it to the customers who carry that tag.
        </FormMessage>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <LockCard title="Protected product">
            <div className="flex items-center gap-4">
              <LockImage src={lock.image_url} size="lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span
                  className="truncate text-[0.95rem] font-semibold"
                  title={lock.title}
                >
                  {lock.title}
                </span>
                <span className="text-text-muted truncate text-[0.8rem]">
                  Product — /products/{lock.handle ?? '—'}
                </span>
                <span className="text-text-muted text-[0.78rem]">
                  {lock.customers_with_access != null
                    ? `${lock.customers_with_access.toLocaleString('en-GB')} customer${lock.customers_with_access === 1 ? '' : 's'} with access`
                    : 'Customers with access: —'}
                  {hidden.length > 0 && ` · hidden from ${hidden.join(' and ')}`}
                  {lock.updated_at && ` · updated ${formatDateTime(lock.updated_at)}`}
                </span>
              </div>
              <Link
                to={`/products/${encodeURIComponent(lock.product_id)}`}
                className={`${SECONDARY} no-underline`}
              >
                <ExternalLinkIcon width={15} height={15} />
                View product
              </Link>
            </div>
          </LockCard>

          <LockCard
            title="Keys (tags)"
            description="A customer who carries one of these tags can open this product. Changes are sent to the store."
          >
            <TagPicker
              shop={shop}
              selected={lock.tags}
              onAdd={(tags) => setTagChange({ kind: 'add', tags })}
              onRemove={(tag) => setTagChange({ kind: 'remove', tags: [tag] })}
            />
          </LockCard>

          <LockMessageCard options={options} onChange={change} />
          <CheckAccessCard lock={lock} shop={shop} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <LockSettingsCard options={options} onChange={change} />
          <LockAdvancedCard options={options} onChange={change} />
        </div>
      </div>

      {saving && body && (
        <LockConfirmDialog
          title={`Update the lock on “${lock.title}”?`}
          confirmLabel="Yes, update"
          onClose={() => setSaving(false)}
          onConfirm={async () => {
            const result = await save(body)
            setSaving(false)
            setEdits({})
            onNotice(result.message)
          }}
        >
          <p>
            Are you sure you want to update this? These changes will also be updated in
            Shopify.
          </p>
        </LockConfirmDialog>
      )}

      {tagChange && (
        <LockConfirmDialog
          title={
            tagChange.kind === 'add'
              ? `Add ${tagChange.tags.length === 1 ? `the tag “${tagChange.tags[0]}”` : `${tagChange.tags.length} tags`}?`
              : `Remove the tag “${tagChange.tags[0]}”?`
          }
          confirmLabel={tagChange.kind === 'add' ? 'Yes, add' : 'Yes, remove'}
          danger={tagChange.kind === 'remove'}
          onClose={() => setTagChange(null)}
          onConfirm={async () => {
            const result = await update({
              shop,
              products: [lock.product_id],
              ...(tagChange.kind === 'add'
                ? { tags_add: tagChange.tags }
                : { tags_remove: tagChange.tags }),
            })
            setTagChange(null)
            onNotice(result.message)
          }}
        >
          {tagChange.kind === 'add' ? (
            <p>
              Customers who carry{' '}
              {tagChange.tags.length === 1 ? 'this tag' : 'these tags'} will be able to
              open this product. This will also be updated in Shopify.
            </p>
          ) : (
            <p>
              Customers who only have this tag will no longer be able to open the product.
              {lock.tags.length === 1 &&
                ' It is the last tag, so the product stops being locked and becomes public again.'}{' '}
              This will also be updated in Shopify.
            </p>
          )}
        </LockConfirmDialog>
      )}
    </div>
  )
}
