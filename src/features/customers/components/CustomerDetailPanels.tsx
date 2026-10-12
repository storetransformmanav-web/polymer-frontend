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
import {
  ListChecksIcon,
  MailIcon,
  MapPinIcon,
  OrdersIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import type { CustomerDetail, CustomerListItem } from '../../../lib/api/endpoints.ts'
import { formatDate, formatPrice } from '../../../lib/format.ts'
import {
  capitalize,
  customerSource,
  formatAddressLines,
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

          {customer.tags.length > 0 && (
            <DetailSection
              title="Tags"
              count={customer.tags.length}
              icon={ListChecksIcon}
            >
              <Chips items={customer.tags} />
            </DetailSection>
          )}

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
