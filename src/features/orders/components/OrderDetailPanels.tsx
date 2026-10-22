import { Link } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge.tsx'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import {
  DETAIL_CARD,
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
  BoxesIcon,
  CheckCircleIcon,
  ClockIcon,
  DollarSignIcon,
  ListChecksIcon,
  MapPinIcon,
  OrdersIcon,
  TagIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import type {
  OrderAddress,
  OrderDetail,
  OrderListItem,
} from '../../../lib/api/endpoints.ts'
import { formatDateTime, formatPrice } from '../../../lib/format.ts'
import { safeUrl } from '../../../lib/safeUrl.ts'
import {
  financialTone,
  formatAddressLines,
  fulfillmentTone,
  humanize,
  orderCustomer,
  recordFields,
  sourceLabel,
} from '../utils/format.ts'

const yesNo = (value: boolean | null | undefined) =>
  value === null || value === undefined ? null : value ? 'Yes' : 'No'
const time = (value: string | null | undefined) => (value ? formatDateTime(value) : null)

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

/** A status as its pill (nothing when the order has none). */
function Status({
  value,
  tone,
}: {
  value: string | null | undefined
  tone: ReturnType<typeof financialTone>
}) {
  return value ? <Badge tone={tone}>{humanize(value)}</Badge> : null
}

// --- Overview -----------------------------------------------------------------

interface OverviewProps {
  order: OrderDetail | null
  /** The matching list row, so the summary can draw before the details arrive. */
  preview: OrderListItem | null
}

export function OrderOverviewPanel({ order, preview }: OverviewProps) {
  const source = order ?? preview
  const currency = source?.currency
  const money = (value: string | null | undefined) =>
    value === null || value === undefined ? null : formatPrice(value, currency)

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <div className={SUMMARY_CARD}>
          <p className={SUMMARY_LABEL}>Total price</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">
            {money(source?.total_price) ?? '—'}
          </p>
          {source && source.items_count > 0 && (
            <p className="text-text-muted mt-1 text-[0.82rem]">
              {source.items_count.toLocaleString('en-GB')}{' '}
              {source.items_count === 1 ? 'item' : 'items'}
            </p>
          )}
        </div>
        <div className={SUMMARY_CARD}>
          <p className={SUMMARY_LABEL}>Net payment</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">
            {money(source?.net_payment) ?? '—'}
          </p>
        </div>
        <div className={SUMMARY_CARD}>
          <p className={SUMMARY_LABEL}>Refunded</p>
          <p className="mt-1 text-xl font-bold tracking-tight">
            {money(source?.total_refunded) ?? '—'}
          </p>
        </div>
      </div>

      {!order ? (
        <DetailSkeleton />
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          <DetailSection title="Order Summary" count={9} icon={DollarSignIcon}>
            <FieldGrid>
              <Field label="Subtotal">{money(order.subtotal_price)}</Field>
              <Field label="Discounts">{money(order.total_discounts)}</Field>
              <Field label="Shipping">{money(order.total_shipping)}</Field>
              <Field label="Tax">{money(order.total_tax)}</Field>
              <Field label="Total price">{money(order.total_price)}</Field>
              <Field label="Refunded">{money(order.total_refunded)}</Field>
              <Field label="Net payment">{money(order.net_payment)}</Field>
              <Field label="Outstanding">{money(order.total_outstanding)}</Field>
              <Field label="Tip">{money(order.total_tip)}</Field>
            </FieldGrid>
          </DetailSection>

          <DetailSection title="Customer" count={5} icon={UsersIcon}>
            <FieldGrid>
              <Field label="Name">{orderCustomer(order)?.name}</Field>
              <Field label="Customer email">
                {order.customer?.email && (
                  <span className="flex items-center gap-1.5 break-words">
                    {order.customer.email}
                    <CopyButton value={order.customer.email} label="Copy email" />
                  </span>
                )}
              </Field>
              <Field label="Phone">{order.customer?.phone ?? order.phone}</Field>
              <Field label="Order email">
                {order.email && (
                  <span className="flex items-center gap-1.5 break-words">
                    {order.email}
                    <CopyButton value={order.email} label="Copy order email" />
                  </span>
                )}
              </Field>
              <Field label="Customer’s orders">
                {order.customer?.orders_count?.toLocaleString('en-GB')}
              </Field>
            </FieldGrid>
          </DetailSection>

          <DetailSection
            title="Status & Dates"
            count={12}
            icon={ClockIcon}
            defaultOpen={false}
          >
            <FieldGrid>
              <Field label="Payment">
                <Status
                  value={order.financial_status}
                  tone={financialTone(order.financial_status)}
                />
              </Field>
              <Field label="Fulfillment">
                <Status
                  value={order.fulfillment_status}
                  tone={fulfillmentTone(order.fulfillment_status)}
                />
              </Field>
              <Field label="Returns">{humanize(order.return_status)}</Field>
              <Field label="Created">{time(order.shopify_created_at)}</Field>
              <Field label="Updated">{time(order.shopify_updated_at)}</Field>
              <Field label="Processed">{time(order.processed_at)}</Field>
              <Field label="Closed">{time(order.closed_at)}</Field>
              <Field label="Cancelled">{time(order.cancelled_at)}</Field>
              <Field label="Cancel reason">{humanize(order.cancel_reason)}</Field>
              <Field label="Confirmed">{yesNo(order.confirmed)}</Field>
              <Field label="Test order">{yesNo(order.test)}</Field>
              <Field label="Taxes included">{yesNo(order.taxes_included)}</Field>
            </FieldGrid>
          </DetailSection>

          <DetailSection
            title="Store & Source"
            count={7}
            icon={OrdersIcon}
            defaultOpen={false}
          >
            <FieldGrid>
              <Field label="Store">{order.shop?.name}</Field>
              <Field label="Currency">{order.currency}</Field>
              <Field label="Presentment currency">{order.presentment_currency}</Field>
              <Field label="Source">{sourceLabel(order.source_name)}</Field>
              <Field label="Payment gateways">
                {order.payment_gateway_names.length > 0 &&
                  order.payment_gateway_names.join(', ')}
              </Field>
              <Field label="PO number">{order.po_number}</Field>
              <Field label="Shopify ID">{order.shopify_id}</Field>
            </FieldGrid>
          </DetailSection>

          {order.tags.length > 0 && (
            <DetailSection title="Tags" count={order.tags.length} icon={TagIcon}>
              <Chips items={order.tags} />
            </DetailSection>
          )}

          {order.note && (
            <DetailSection title="Note" icon={ListChecksIcon}>
              <p className="text-[0.9rem] leading-relaxed whitespace-pre-line">
                {order.note}
              </p>
            </DetailSection>
          )}
        </div>
      )}
    </div>
  )
}

// --- Items ----------------------------------------------------------------------

export function OrderItemsPanel({ order }: { order: OrderDetail }) {
  if (order.line_items.length === 0) {
    return <DetailEmpty icon={BoxesIcon}>No items on this order.</DetailEmpty>
  }
  const money = (value: string | null | undefined) => formatPrice(value, order.currency)

  return (
    <DetailTable>
      <thead>
        <tr>
          <th className={TH}>Product</th>
          <th className={TH}>SKU</th>
          <th className={`${TH} text-right`}>Qty</th>
          <th className={`${TH} text-right`}>Price</th>
          <th className={`${TH} text-right`}>Discount</th>
          <th className={`${TH} text-right`}>Total</th>
          <th className={TH}>Fulfillment</th>
        </tr>
      </thead>
      <tbody>
        {order.line_items.map((item) => {
          const image = safeUrl(item.image_url)
          const title = item.title || 'Item'
          return (
            <tr
              key={item.id}
              className="border-border even:bg-surface border-b last:border-b-0"
            >
              <td className={TD}>
                <span className="flex items-center gap-3">
                  <span className="bg-surface border-border flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
                    {image ? (
                      <img
                        src={image}
                        alt=""
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <BoxesIcon width={18} height={18} className="text-text-muted" />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    {item.product_id ? (
                      <Link
                        to={`/products/${encodeURIComponent(item.product_id)}`}
                        className="text-text hover:text-accent max-w-80 truncate font-semibold hover:underline"
                        title={title}
                      >
                        {title}
                      </Link>
                    ) : (
                      <span className="max-w-80 truncate font-semibold" title={title}>
                        {title}
                      </span>
                    )}
                    {item.variant_title && (
                      <span className="text-text-muted text-[0.78rem]">
                        {item.variant_title}
                      </span>
                    )}
                    {item.vendor && (
                      <span className="text-text-muted text-[0.78rem]">
                        {item.vendor}
                      </span>
                    )}
                  </span>
                </span>
              </td>
              <td className={`${TD} font-mono text-[0.8rem]`}>{item.sku || '—'}</td>
              <td className={`${TD} text-right tabular-nums`}>{item.quantity ?? '—'}</td>
              <td className={`${TD} text-right tabular-nums`}>{money(item.price)}</td>
              <td className={`${TD} text-right tabular-nums`}>
                {money(item.total_discount)}
              </td>
              <td className={`${TD} text-right font-semibold tabular-nums`}>
                {money(item.discounted_total ?? item.original_total)}
              </td>
              <td className={TD}>
                {item.fulfillment_status ? (
                  <Badge tone={fulfillmentTone(item.fulfillment_status)}>
                    {humanize(item.fulfillment_status)}
                  </Badge>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </DetailTable>
  )
}

// --- Payments -------------------------------------------------------------------

function Records({
  records,
  empty,
}: {
  records: Record<string, unknown>[]
  empty: string
}) {
  const usable = records.map(recordFields).filter((fields) => fields.length > 0)
  if (usable.length === 0)
    return <p className="text-text-muted text-[0.88rem]">{empty}</p>
  return (
    <ul className="flex flex-col gap-3">
      {usable.map((fields, index) => (
        <li key={index} className="border-border bg-bg rounded-lg border p-4">
          <FieldGrid>
            {fields.map(([label, value]) => (
              <Field key={label} label={label}>
                {value}
              </Field>
            ))}
          </FieldGrid>
        </li>
      ))}
    </ul>
  )
}

export function OrderPaymentsPanel({ order }: { order: OrderDetail }) {
  const money = (value: string | null | undefined) =>
    value === null || value === undefined ? '—' : formatPrice(value, order.currency)

  return (
    <div className="flex flex-col gap-4">
      <DetailSection
        title="Transactions"
        count={order.transactions.length}
        icon={DollarSignIcon}
      >
        {order.transactions.length === 0 ? (
          <p className="text-text-muted text-[0.88rem]">No payments yet.</p>
        ) : (
          <DetailTable>
            <thead>
              <tr>
                <th className={TH}>Type</th>
                <th className={TH}>Status</th>
                <th className={TH}>Gateway</th>
                <th className={TH}>Method</th>
                <th className={`${TH} text-right`}>Amount</th>
                <th className={TH}>Processed</th>
              </tr>
            </thead>
            <tbody>
              {order.transactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  className="border-border even:bg-surface border-b last:border-b-0"
                >
                  <td className={TD}>{humanize(transaction.kind) || '—'}</td>
                  <td className={TD}>
                    {transaction.status ? (
                      <Badge
                        tone={
                          transaction.status === 'SUCCESS'
                            ? 'success'
                            : transaction.status === 'PENDING'
                              ? 'warning'
                              : 'danger'
                        }
                      >
                        {humanize(transaction.status)}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={TD}>{transaction.gateway || '—'}</td>
                  <td className={TD}>
                    {[transaction.card_brand, transaction.card_last4]
                      .filter(Boolean)
                      .join(' ') ||
                      humanize(transaction.payment_method) ||
                      '—'}
                  </td>
                  <td className={`${TD} text-right font-semibold tabular-nums`}>
                    {money(transaction.amount)}
                  </td>
                  <td className={TD}>{time(transaction.processed_at) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </DetailTable>
        )}
      </DetailSection>

      <DetailSection title="Refunds" count={order.refunds.length} icon={CheckCircleIcon}>
        <Records records={order.refunds} empty="Nothing has been refunded." />
      </DetailSection>

      <DetailSection title="Taxes" count={order.tax_lines.length} icon={ListChecksIcon}>
        {order.tax_lines.length === 0 ? (
          <p className="text-text-muted text-[0.88rem]">No tax lines.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-[0.88rem]">
            {order.tax_lines.map((line, index) => (
              <li key={`${line.title}-${index}`} className="flex justify-between gap-3">
                <span>
                  {line.title || 'Tax'}
                  {line.rate !== null && line.rate !== undefined && (
                    <span className="text-text-muted"> ({Number(line.rate) * 100}%)</span>
                  )}
                </span>
                <span className="font-semibold">{money(line.price)}</span>
              </li>
            ))}
          </ul>
        )}
      </DetailSection>

      <DetailSection
        title="Discounts"
        count={order.discounts.length}
        icon={TagIcon}
        defaultOpen={order.discounts.length > 0}
      >
        <Records records={order.discounts} empty="No discounts were applied." />
      </DetailSection>
    </div>
  )
}

// --- Shipping -------------------------------------------------------------------

function AddressCard({
  title,
  address,
}: {
  title: string
  address: OrderAddress | null | undefined
}) {
  const lines = formatAddressLines(address)
  const name =
    address?.name || [address?.first_name, address?.last_name].filter(Boolean).join(' ')
  return (
    <section className={`${DETAIL_CARD} flex flex-col gap-1.5 p-4 text-[0.88rem]`}>
      <h3 className="flex items-center gap-2 text-[0.95rem] font-semibold">
        <MapPinIcon width={18} height={18} className="text-accent" />
        {title}
      </h3>
      {!address || (lines.length === 0 && !name) ? (
        <p className="text-text-muted">No address.</p>
      ) : (
        <>
          {name && <span className="font-semibold">{name}</span>}
          {address.company && <span className="text-text-muted">{address.company}</span>}
          {lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
          {address.phone && <span className="text-text-muted">{address.phone}</span>}
        </>
      )}
    </section>
  )
}

export function OrderShippingPanel({ order }: { order: OrderDetail }) {
  const money = (value: string | null | undefined) =>
    value === null || value === undefined ? '—' : formatPrice(value, order.currency)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <AddressCard title="Shipping address" address={order.shipping_address} />
        <AddressCard title="Billing address" address={order.billing_address} />
      </div>

      <DetailSection
        title="Shipping method"
        count={order.shipping_lines.length}
        icon={OrdersIcon}
      >
        {order.shipping_lines.length === 0 ? (
          <p className="text-text-muted text-[0.88rem]">No shipping method.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-[0.88rem]">
            {order.shipping_lines.map((line, index) => (
              <li
                key={`${line.code}-${index}`}
                className="flex items-start justify-between gap-3"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold">{line.title || 'Shipping'}</span>
                  {line.source && (
                    <span className="text-text-muted text-[0.78rem]">{line.source}</span>
                  )}
                </span>
                <span className="font-semibold">
                  {money(line.discounted_price ?? line.price)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DetailSection>

      <DetailSection
        title="Fulfillments"
        count={order.fulfillments.length}
        icon={CheckCircleIcon}
      >
        <Records records={order.fulfillments} empty="Nothing has been fulfilled yet." />
      </DetailSection>
    </div>
  )
}

// --- Notes & tracking -------------------------------------------------------------

export function OrderAttributesPanel({ order }: { order: OrderDetail }) {
  if (order.note_attributes.length === 0) {
    return <DetailEmpty icon={ListChecksIcon}>No notes or tracking details.</DetailEmpty>
  }

  return (
    <DetailTable>
      <thead>
        <tr>
          <th className={TH}>Name</th>
          <th className={TH}>Value</th>
        </tr>
      </thead>
      <tbody>
        {order.note_attributes.map((attribute, index) => {
          const link = safeUrl(attribute.value)
          return (
            <tr
              key={`${attribute.key}-${index}`}
              className="border-border even:bg-surface border-b last:border-b-0"
            >
              <td className={`${TD} font-mono text-[0.8rem]`}>{attribute.key}</td>
              <td
                className={`${TD} max-w-[34rem] truncate`}
                title={attribute.value ?? ''}
              >
                {link ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    {attribute.value}
                  </a>
                ) : (
                  (attribute.value ?? '—')
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </DetailTable>
  )
}

// --- Timeline ---------------------------------------------------------------------

export function OrderEventsPanel({ order }: { order: OrderDetail }) {
  if (order.events.length === 0) {
    return <DetailEmpty icon={ClockIcon}>No events yet.</DetailEmpty>
  }
  return <Records records={order.events} empty="No events yet." />
}
