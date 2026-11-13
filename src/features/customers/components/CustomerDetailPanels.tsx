import { useState, type ComponentType, type ReactNode } from 'react'
import { useAppSelector } from '../../../app/store/hooks.ts'
import { Badge } from '../../../components/ui/Badge.tsx'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import {
  DetailSection,
  DetailSkeleton,
  Field,
  FieldGrid,
} from '../../../components/ui/DetailSection.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { IconAction } from '../../../components/ui/IconAction.tsx'
import {
  CheckIcon,
  ChevronRightIcon,
  ListChecksIcon,
  MailIcon,
  MapPinIcon,
  OrdersIcon,
  PencilIcon,
  PhoneIcon,
  UsersIcon,
  XIcon,
  type IconProps,
} from '../../../components/ui/icons.tsx'
import { useAccess } from '../../../hooks/useAccess.ts'
import type {
  CustomerAddress,
  CustomerDetail,
  CustomerListItem,
} from '../../../lib/api/endpoints.ts'
import { formatDate, formatPrice } from '../../../lib/format.ts'
import { mergeTags, TagsInput, useStoreTags } from '../../products/index.ts'
import { useUpdateCustomer } from '../hooks/useUpdateCustomer.ts'
import { CustomerUpdateDialog } from './CustomerUpdateDialog.tsx'
import { formatAddressLines, customerName, humanize } from '../utils/format.ts'

const yesNo = (value: boolean | null | undefined) =>
  value === null || value === undefined ? null : value ? 'Yes' : 'No'
const date = (value: string | null | undefined) => (value ? formatDate(value) : null)

function Chips({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li
          key={item}
          className="bg-accent-tint text-accent rounded-full px-2.5 py-0.5 text-xs font-semibold"
        >
          {item}
        </li>
      ))}
    </ul>
  )
}

// --- Tags ---------------------------------------------------------------------

/**
 * The customer's tags, edited in place like a product's: a pencil in the card's header turns
 * them into the tag box (with every tag seen so far offered while typing), and the pencil becomes
 * ✓ Save and ✕ Discard. Saving asks "Are you sure?" with what is added and removed, and only
 * "Yes, update" sends `PUT /customers/{ref}` with the full list of tags (`tags` is the whole list,
 * not a change). Only for people who may manage customers.
 */
function CustomerTagsCard({ customer }: { customer: CustomerDetail }) {
  const { canManage } = useAccess('customers')
  // Every tag the store has (from the tags API, asked for once the pencil is pressed), together
  // with the tags seen on the customers loaded so far — so the box offers all of them, and still
  // works when the call is refused.
  const seen = useAppSelector((state) => state.customers.facets.tags)
  const [editingStarted, setEditingStarted] = useState(false)
  const store = useStoreTags(customer.shop?.key ? [customer.shop.key] : [], {
    enabled: editingStarted,
  })
  const known = mergeTags(store.tags, seen, customer.tags)
  const { update, isUpdating, error, clearError } = useUpdateCustomer()
  const [draft, setDraft] = useState<string[] | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const editing = draft !== null
  const added = (draft ?? []).filter((tag) => !customer.tags.includes(tag))
  const removed = customer.tags.filter((tag) => !(draft ?? customer.tags).includes(tag))
  const changed = added.length > 0 || removed.length > 0

  function discard() {
    setDraft(null)
    setConfirming(false)
    clearError()
  }

  async function confirm() {
    if (!draft) return
    const result = await update({
      id: customer.id,
      shop: customer.shop?.key ?? null,
      body: { tags: draft },
    })
    if (!result) return
    setNotice(result.message || 'Tags updated. They are also updated in Shopify.')
    setConfirming(false)
    setDraft(null)
  }

  return (
    <>
      <DetailSection
        title="Tags"
        count={customer.tags.length}
        icon={ListChecksIcon}
        actions={
          canManage ? (
            editing ? (
              <>
                <IconAction
                  label="Save"
                  accessibleLabel="Save tags"
                  icon={CheckIcon}
                  tone="primary"
                  disabled={!changed}
                  onClick={() => setConfirming(true)}
                />
                <IconAction
                  label="Discard"
                  accessibleLabel="Discard tags"
                  icon={XIcon}
                  onClick={discard}
                />
              </>
            ) : (
              <IconAction
                label="Edit"
                accessibleLabel="Edit tags"
                icon={PencilIcon}
                onClick={() => {
                  setNotice(null)
                  setEditingStarted(true)
                  setDraft([...customer.tags])
                }}
              />
            )
          ) : undefined
        }
      >
        <div className="flex flex-col gap-3">
          {notice && <FormMessage tone="success">{notice}</FormMessage>}
          {editing ? (
            <TagsInput
              id="customer-tags"
              ariaLabel="Add tags"
              listLabel="Tags"
              removeLabel={(tag) => `Remove tag ${tag}`}
              tags={draft}
              onChange={setDraft}
              suggestions={known}
              suggestAll
              autoFocus
            />
          ) : customer.tags.length > 0 ? (
            <Chips items={customer.tags} />
          ) : (
            <p className="text-text-muted m-0 text-[0.85rem]">
              This customer has no tags.
            </p>
          )}
        </div>
      </DetailSection>

      {confirming && (
        <CustomerUpdateDialog
          title={`Update “${customerName(customer)}”?`}
          added={added}
          removed={removed}
          isUpdating={isUpdating}
          error={error}
          onConfirm={() => void confirm()}
          onCancel={() => {
            if (!isUpdating) {
              setConfirming(false)
              clearError()
            }
          }}
        />
      )}
    </>
  )
}

// --- Overview -----------------------------------------------------------------

/** One labelled fact of the Contact & Account card: a small accent icon, the label, the value. */
function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: ComponentType<IconProps>
  label: string
  children: ReactNode
}) {
  const empty = children === null || children === undefined || children === ''
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Icon width={18} height={18} className="text-accent mt-0.5 shrink-0" />
      <div className="min-w-0">
        <dt className="text-text-muted mb-0.5 text-[0.68rem] font-bold tracking-wide uppercase">
          {label}
        </dt>
        <dd className="text-[0.88rem] font-medium break-words">
          {empty ? <span className="text-text-muted">—</span> : children}
        </dd>
      </div>
    </div>
  )
}

/** The customer's default address: the one marked default, else the first saved one. */
function defaultAddressOf(customer: CustomerDetail): CustomerAddress | null {
  return (
    customer.addresses.find((address) => address.is_default) ??
    customer.addresses[0] ??
    null
  )
}

/**
 * Contact & Account: only what matters at a glance — the customer's name, a phone number and the
 * Shopify ID. (Email, role, state and dates are in the header, marketing is on its own tab.) When
 * the customer has no phone of their own, the default address's phone is shown instead.
 */
function ContactCard({ customer }: { customer: CustomerDetail }) {
  const own = customer.phone?.trim()
  const fromAddress = defaultAddressOf(customer)?.phone?.trim()
  const phone = own || fromAddress
  return (
    <DetailSection title="Contact & Account" icon={UsersIcon}>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-5 min-[520px]:grid-cols-3 min-[520px]:[&>*:not(:first-child)]:border-l min-[520px]:[&>*:not(:first-child)]:pl-4">
        <Fact icon={UsersIcon} label="Name">
          {customerName(customer)}
        </Fact>
        <Fact icon={PhoneIcon} label="Phone">
          {phone && (
            <>
              {phone}
              {!own && <span className="text-text-muted"> · default address</span>}
            </>
          )}
        </Fact>
        <Fact icon={ListChecksIcon} label="Shopify ID">
          {customer.shopify_id != null && (
            <span className="flex items-center gap-1.5">
              <span className="break-all">{customer.shopify_id}</span>
              <CopyButton value={String(customer.shopify_id)} label="Copy Shopify ID" />
            </span>
          )}
        </Fact>
      </dl>
    </DetailSection>
  )
}

/** One saved address as a card: name, company, the address on one line, phone, copy, Default. */
function AddressCard({ address }: { address: CustomerAddress }) {
  const lines = formatAddressLines(address)
  // The parts on one line, as on an order's address card: "212 Essex Road, Inner
  // London, London, N1 3AP, United Kingdom".
  const summary = [
    address.address1,
    address.address2,
    address.city,
    address.province,
    address.zip,
    address.country,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ')
  const name =
    address.name || [address.first_name, address.last_name].filter(Boolean).join(' ')
  return (
    <li
      className={`flex gap-3 rounded-xl border p-4 text-[0.85rem] ${
        address.is_default ? 'border-accent bg-accent-tint/40' : 'border-border bg-bg'
      }`}
    >
      <MapPinIcon width={18} height={18} className="text-accent mt-0.5 shrink-0" />
      <address className="m-0 flex min-w-0 flex-1 flex-col gap-0.5 leading-snug break-words not-italic">
        <span>
          <span className="font-semibold">{name || 'Address'}</span>
          {address.company && (
            <>
              <span className="text-text-muted"> · </span>
              <span className="text-text-muted">{address.company}</span>
            </>
          )}
        </span>
        {summary && <span>{summary}</span>}
        {address.phone && (
          <span className="text-text-muted flex items-center gap-1.5">
            <PhoneIcon width={14} height={14} className="shrink-0" />
            {address.phone}
          </span>
        )}
      </address>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <CopyButton
          value={[name, address.company, ...lines, address.phone]
            .filter(Boolean)
            .join('\n')}
          label="Copy address"
        />
        {address.is_default && <Badge tone="default">Default</Badge>}
      </div>
    </li>
  )
}

/**
 * Addresses on the Overview: only the default address. When the customer has more, a
 * "View more addresses" button opens the Addresses tab, which lists all of them.
 */
function AddressesCard({
  customer,
  onShowMore,
}: {
  customer: CustomerDetail
  onShowMore?: () => void
}) {
  const main = defaultAddressOf(customer)
  const more = customer.addresses.length - 1
  return (
    <DetailSection title="Addresses" count={customer.addresses.length} icon={MapPinIcon}>
      {!main ? (
        <p className="text-text-muted m-0 text-[0.85rem]">No saved addresses.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="grid gap-3">
            <AddressCard address={main} />
          </ul>
          {more > 0 && onShowMore && (
            <button
              type="button"
              onClick={onShowMore}
              className="border-border bg-bg text-accent hover:border-accent inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[0.82rem] font-semibold transition-colors"
            >
              View more addresses ({more})
              <ChevronRightIcon width={14} height={14} />
            </button>
          )}
        </div>
      )}
    </DetailSection>
  )
}

/** The Addresses tab: every saved address, the default first. */
export function CustomerAddressesPanel({ customer }: { customer: CustomerDetail }) {
  const ordered = [...customer.addresses].sort(
    (a, b) => Number(Boolean(b.is_default)) - Number(Boolean(a.is_default)),
  )
  return (
    <DetailSection title="All addresses" count={ordered.length} icon={MapPinIcon}>
      {ordered.length === 0 ? (
        <p className="text-text-muted m-0 text-[0.85rem]">No saved addresses.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {ordered.map((address) => (
            <AddressCard key={address.id} address={address} />
          ))}
        </ul>
      )}
    </DetailSection>
  )
}

interface OverviewProps {
  customer: CustomerDetail | null
  /** The matching list row, so the summary can draw before details arrive. */
  preview: CustomerListItem | null
  /** "View more addresses": opens the Addresses tab. */
  onShowAddresses?: () => void
  /** "View history": opens the Orders tab (the order history). */
  onViewOrderHistory?: () => void
}

const MINI_LABEL = 'text-text-muted text-[0.68rem] font-bold tracking-wide uppercase'

/**
 * The Overview tab: on the left Contact & Account, Addresses, Tags (and the note); on the right
 * Orders & Spend. The right card draws from the list row while the full record loads.
 */
export function CustomerOverviewPanel({
  customer,
  preview,
  onShowAddresses,
  onViewOrderHistory,
}: OverviewProps) {
  const source = customer ?? preview
  const orders = source?.orders_count ?? 0
  const lastOrder = source?.last_order_name
  const summary = customer?.order_summary ?? null

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      {!customer ? (
        <DetailSkeleton />
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          <ContactCard customer={customer} />
          <AddressesCard customer={customer} onShowMore={onShowAddresses} />
          <CustomerTagsCard customer={customer} />

          {customer.note && (
            <DetailSection title="Note" icon={ListChecksIcon}>
              <p className="text-[0.9rem] leading-relaxed whitespace-pre-line">
                {customer.note}
              </p>
            </DetailSection>
          )}
        </div>
      )}

      <DetailSection
        title="Orders & Spend"
        icon={OrdersIcon}
        actions={
          onViewOrderHistory && customer ? (
            <button
              type="button"
              onClick={onViewOrderHistory}
              className="border-border bg-bg text-accent hover:border-accent inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border px-2.5 text-[0.75rem] font-semibold transition-colors"
            >
              View history
              <ChevronRightIcon width={12} height={12} />
            </button>
          ) : undefined
        }
      >
        <div className="border-border bg-surface grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl border p-4">
          <div>
            <p className={MINI_LABEL}>Orders</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">
              {orders.toLocaleString('en-GB')}
            </p>
          </div>
          <div className="text-right">
            <p className={MINI_LABEL}>Total spent</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">
              {formatPrice(source?.total_spent ?? '0', source?.currency)}
            </p>
          </div>
          <div className="border-border col-span-2 grid grid-cols-2 gap-x-4 border-t pt-4">
            <div>
              <p className={`${MINI_LABEL} mb-1.5`}>RFM group</p>
              {customer?.rfm_group ? (
                <Badge tone="success">{humanize(customer.rfm_group)}</Badge>
              ) : (
                <span className="text-text-muted">—</span>
              )}
            </div>
            <div className="text-right">
              <p className={`${MINI_LABEL} mb-1.5`}>Predicted spend tier</p>
              {customer?.predicted_spend_tier ? (
                <Badge tone="default">{humanize(customer.predicted_spend_tier)}</Badge>
              ) : (
                <span className="text-text-muted">—</span>
              )}
            </div>
          </div>
        </div>
        {summary?.first_order_name || summary?.last_order_name ? (
          <dl className="border-border m-0 mt-3 grid grid-cols-2 gap-x-4 rounded-xl border p-4">
            <div>
              <dt className={MINI_LABEL}>First order</dt>
              <dd className="m-0 mt-1 text-[0.9rem] font-semibold">
                {summary.first_order_name ?? '—'}
              </dd>
              {summary.first_order_at && (
                <dd className="text-text-muted m-0 text-[0.78rem]">
                  {formatDate(summary.first_order_at)}
                </dd>
              )}
            </div>
            <div className="text-right">
              <dt className={MINI_LABEL}>Latest order</dt>
              <dd className="m-0 mt-1 text-[0.9rem] font-semibold">
                {summary.last_order_name ?? lastOrder ?? '—'}
              </dd>
              {summary.last_order_at && (
                <dd className="text-text-muted m-0 text-[0.78rem]">
                  {formatDate(summary.last_order_at)}
                </dd>
              )}
            </div>
          </dl>
        ) : (
          lastOrder && (
            <p className="text-text-muted mt-3 text-[0.82rem]">Last order {lastOrder}</p>
          )
        )}
      </DetailSection>
    </div>
  )
}

// --- Marketing & tax ------------------------------------------------------------

export function CustomerMarketingPanel({ customer }: { customer: CustomerDetail }) {
  return (
    <div className="flex flex-col gap-4">
      <DetailSection title="Marketing" count={8} icon={MailIcon}>
        <FieldGrid>
          <Field label="Accepts marketing">{yesNo(customer.accepts_marketing)}</Field>
          <Field label="Email marketing">
            {humanize(customer.email_marketing_state)}
          </Field>
          <Field label="Email opt-in level">
            {humanize(customer.email_marketing_opt_in_level)}
          </Field>
          <Field label="Email updated">{date(customer.email_marketing_updated_at)}</Field>
          <Field label="SMS marketing">{humanize(customer.sms_marketing_state)}</Field>
          <Field label="SMS opt-in level">
            {humanize(customer.sms_marketing_opt_in_level)}
          </Field>
          <Field label="SMS updated">{date(customer.sms_marketing_updated_at)}</Field>
          <Field label="Opted out of data sale">
            {yesNo(customer.data_sale_opt_out)}
          </Field>
        </FieldGrid>
      </DetailSection>

      <DetailSection title="Tax" count={3} icon={ListChecksIcon}>
        <FieldGrid>
          <Field label="Tax exempt">{yesNo(customer.tax_exempt)}</Field>
          <Field label="Tax ID">{customer.tax_id}</Field>
          <Field label="Exemptions">
            {customer.tax_exemptions.length > 0 && (
              <Chips items={customer.tax_exemptions} />
            )}
          </Field>
        </FieldGrid>
      </DetailSection>
    </div>
  )
}
