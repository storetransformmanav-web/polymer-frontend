import { useState } from 'react'
import { useAppSelector } from '../../../app/store/hooks.ts'
import { Badge } from '../../../components/ui/Badge.tsx'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import {
  DETAIL_TD as TD,
  DETAIL_TH as TH,
  DetailEmpty,
  DetailSection,
  DetailSkeleton,
  DetailTable,
  Field,
  FieldGrid,
} from '../../../components/ui/DetailSection.tsx'
import { FormMessage } from '../../../components/ui/FormMessage.tsx'
import { IconAction } from '../../../components/ui/IconAction.tsx'
import {
  CheckIcon,
  ListChecksIcon,
  MailIcon,
  MapPinIcon,
  OrdersIcon,
  PencilIcon,
  UsersIcon,
  XIcon,
} from '../../../components/ui/icons.tsx'
import { useAccess } from '../../../hooks/useAccess.ts'
import type { CustomerDetail, CustomerListItem } from '../../../lib/api/endpoints.ts'
import { formatDate, formatPrice } from '../../../lib/format.ts'
import { mergeTags, TagsInput, useStoreTags } from '../../products/index.ts'
import { useUpdateCustomer } from '../hooks/useUpdateCustomer.ts'
import { CustomerUpdateDialog } from './CustomerUpdateDialog.tsx'
import {
  capitalize,
  customerSource,
  formatAddressLines,
  customerName,
  humanize,
  roleTone,
  stateTone,
} from '../utils/format.ts'

const yesNo = (value: boolean | null | undefined) =>
  value === null || value === undefined ? null : value ? 'Yes' : 'No'
const date = (value: string | null | undefined) => (value ? formatDate(value) : null)

const SUMMARY_CARD = 'border-border bg-accent-tint/50 rounded-xl border p-5'
const SUMMARY_LABEL = 'text-text-muted text-[0.7rem] font-bold tracking-wide uppercase'

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

interface OverviewProps {
  customer: CustomerDetail | null
  /** The matching list row, so the summary can draw before details arrive. */
  preview: CustomerListItem | null
}

export function CustomerOverviewPanel({ customer, preview }: OverviewProps) {
  const source = customer ?? preview
  const currency = source?.currency
  const orders = source?.orders_count ?? 0
  const lastOrder = source?.last_order_name
  const since = customer
    ? (customer.shopify_created_at ?? customer.created_at)
    : preview?.shopify_created_at

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <div className={SUMMARY_CARD}>
          <p className={SUMMARY_LABEL}>Total spent</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">
            {formatPrice(source?.total_spent ?? '0', currency)}
          </p>
        </div>
        <div className={SUMMARY_CARD}>
          <p className={SUMMARY_LABEL}>Orders</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">
            {orders.toLocaleString('en-GB')}
          </p>
          {lastOrder && (
            <p className="text-text-muted mt-1 text-[0.82rem]">Last order {lastOrder}</p>
          )}
        </div>
        <div className={SUMMARY_CARD}>
          <p className={SUMMARY_LABEL}>Customer since</p>
          <p className="mt-1 text-xl font-bold tracking-tight">{date(since) ?? '—'}</p>
        </div>
      </div>

      {!customer ? (
        <DetailSkeleton />
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          <DetailSection title="Contact & Account" count={12} icon={UsersIcon}>
            <FieldGrid>
              <Field label="Email">
                {customer.email && (
                  <span className="flex items-center gap-1.5 break-words">
                    {customer.email}
                    <CopyButton value={customer.email} label="Copy email" />
                  </span>
                )}
              </Field>
              <Field label="Phone">{customer.phone}</Field>
              <Field label="Role">
                <Badge tone={roleTone(customer.role)}>{capitalize(customer.role)}</Badge>
              </Field>
              <Field label="Status">
                <Badge tone={customer.is_active ? 'success' : 'danger'}>
                  {customer.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </Field>
              <Field label="Source">{customerSource(customer)}</Field>
              <Field label="Shopify account">
                {customer.shopify_state && (
                  <Badge tone={stateTone(customer.shopify_state)}>
                    {capitalize(customer.shopify_state)}
                  </Badge>
                )}
              </Field>
              <Field label="Email verified">
                {yesNo(customer.verified_email) ?? date(customer.email_verified_at)}
              </Field>
              <Field label="Locale">{customer.locale}</Field>
              <Field label="Shopify ID">{customer.shopify_id}</Field>
              <Field label="Last login">{date(customer.last_login_at)}</Field>
              <Field label="Created">{date(customer.created_at)}</Field>
              <Field label="Updated">{date(customer.updated_at)}</Field>
            </FieldGrid>
          </DetailSection>

          <DetailSection title="Orders & Spend" count={5} icon={OrdersIcon}>
            <FieldGrid>
              <Field label="Orders">
                {customer.orders_count.toLocaleString('en-GB')}
              </Field>
              <Field label="Total spent">
                {formatPrice(customer.total_spent ?? '0', customer.currency)}
              </Field>
              <Field label="Last order">{customer.last_order_name}</Field>
              <Field label="RFM group">{humanize(customer.rfm_group)}</Field>
              <Field label="Predicted spend tier">
                {humanize(customer.predicted_spend_tier)}
              </Field>
            </FieldGrid>
          </DetailSection>

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
    </div>
  )
}

// --- Addresses ----------------------------------------------------------------

export function CustomerAddressesPanel({ customer }: { customer: CustomerDetail }) {
  if (customer.addresses.length === 0) {
    return <DetailEmpty icon={MapPinIcon}>No saved addresses.</DetailEmpty>
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {customer.addresses.map((address) => {
        const lines = formatAddressLines(address)
        const name =
          address.name ||
          [address.first_name, address.last_name].filter(Boolean).join(' ')
        return (
          <li
            key={address.id}
            className="border-border bg-bg flex flex-col gap-1.5 rounded-xl border p-4 text-[0.88rem]"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-semibold">{name || 'Address'}</span>
              {address.is_default && <Badge tone="default">Default</Badge>}
            </span>
            {address.company && (
              <span className="text-text-muted">{address.company}</span>
            )}
            {lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
            {address.phone && <span className="text-text-muted">{address.phone}</span>}
          </li>
        )
      })}
    </ul>
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

// --- Metafields -----------------------------------------------------------------

export function CustomerMetafieldsPanel({ customer }: { customer: CustomerDetail }) {
  if (customer.metafields.length === 0) {
    return <DetailEmpty icon={ListChecksIcon}>No metafields.</DetailEmpty>
  }

  return (
    <DetailTable>
      <thead>
        <tr>
          <th className={TH}>Field</th>
          <th className={TH}>Type</th>
          <th className={TH}>Value</th>
        </tr>
      </thead>
      <tbody>
        {customer.metafields.map((field) => (
          <tr
            key={`${field.namespace}.${field.key}`}
            className="border-border even:bg-surface border-b last:border-b-0"
          >
            <td className={`${TD} font-mono text-[0.8rem]`}>
              {field.namespace}.{field.key}
            </td>
            <td className={TD}>{field.type ?? '—'}</td>
            <td className={`${TD} max-w-96 truncate`} title={field.value ?? ''}>
              {field.value ?? '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </DetailTable>
  )
}
