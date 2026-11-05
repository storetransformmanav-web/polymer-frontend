import { Link } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge.tsx'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { DetailSkeleton } from '../../../components/ui/DetailSection.tsx'
import {
  DollarSignIcon,
  OrdersIcon,
  TagIcon,
  UsersIcon,
} from '../../../components/ui/icons.tsx'
import type { OrderDetail, OrderListItem } from '../../../lib/api/endpoints.ts'
import { formatPrice } from '../../../lib/format.ts'
import { safeUrl } from '../../../lib/safeUrl.ts'
import {
  customerPath,
  financialTone,
  fulfillmentTone,
  humanize,
  orderCustomer,
} from '../utils/format.ts'
import { transactionMethod, transactionTone } from '../utils/payment.ts'
import { itemsToShip, orderTracking } from '../utils/tracking.ts'
import { OrderAddresses } from './OrderAddressCards.tsx'
import { Chips, EmptyNote, MiniCard, Row, Rows } from './OrderCompact.tsx'
import { OrderItemsSummary } from './OrderItemsPanel.tsx'

interface OverviewProps {
  order: OrderDetail | null
  /** The matching list row, so the summary can draw before the details arrive. */
  preview: OrderListItem | null
}

/** The Overview's **Payment Summary**: the payment status, then each transaction in a few rows. */
function PaymentSummary({ order }: { order: OrderDetail }) {
  const money = (value: string | null | undefined) =>
    value === null || value === undefined ? null : formatPrice(value, order.currency)
  return (
    <MiniCard title="Payment Summary" icon={DollarSignIcon}>
      <Rows>
        <Row label="Payment status">
          {order.financial_status && (
            <Badge tone={financialTone(order.financial_status)}>
              {humanize(order.financial_status)}
            </Badge>
          )}
        </Row>
      </Rows>
      {order.transactions.length === 0 ? (
        <EmptyNote>No payments yet.</EmptyNote>
      ) : (
        order.transactions.map((transaction) => (
          <div key={transaction.id} className="border-border border-t">
            <Rows>
              <Row label="Transaction type">{humanize(transaction.kind)}</Row>
              <Row label="Gateway">{transaction.gateway}</Row>
              <Row label="Payment method">{transactionMethod(transaction)}</Row>
              <Row label="Transaction amount" strong>
                {money(transaction.amount)}
              </Row>
              {transaction.status && (
                <Row label="Transaction status">
                  <Badge tone={transactionTone(transaction.status)}>
                    {humanize(transaction.status)}
                  </Badge>
                </Row>
              )}
            </Rows>
          </div>
        ))
      )}
    </MiniCard>
  )
}

/** The Overview's **Shipping Summary**: how it goes out, what was charged, and the tracking. */
function ShippingSummary({ order }: { order: OrderDetail }) {
  const { tracking } = orderTracking(order)
  const methods = order.shipping_lines.map((line) => line.title).filter(Boolean)
  const toShip = itemsToShip(order)
  return (
    <MiniCard title="Shipping Summary" icon={OrdersIcon}>
      <Rows>
        <Row label="Delivery method">
          {methods.length > 0 ? methods.join(', ') : null}
        </Row>
        <Row label="Shipping charged">
          {order.total_shipping === null || order.total_shipping === undefined
            ? null
            : formatPrice(order.total_shipping, order.currency)}
        </Row>
        <Row label="Fulfillment status">
          {order.fulfillment_status && (
            <Badge tone={fulfillmentTone(order.fulfillment_status)}>
              {humanize(order.fulfillment_status)}
            </Badge>
          )}
        </Row>
        <Row label="Items to ship">{toShip > 0 ? String(toShip) : null}</Row>
        <Row label="Fulfillments">{String(order.fulfillments.length)}</Row>
        {tracking.map((entry) => {
          const link = safeUrl(entry.url)
          return (
            <Row
              key={entry.key}
              label={entry.company ? `Tracking · ${entry.company}` : 'Tracking'}
            >
              <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5">
                {entry.number && (
                  <span className="flex items-center gap-1 font-mono text-[0.74rem] break-all">
                    {entry.number}
                    <CopyButton value={entry.number} label="Copy tracking number" />
                  </span>
                )}
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent font-semibold hover:underline"
                  >
                    Track parcel
                  </a>
                )}
              </span>
            </Row>
          )
        })}
      </Rows>
    </MiniCard>
  )
}

/**
 * The Overview, in small cards: **Order Summary** (the Shopify ID and the money — drawn from the
 * list row while the details load), **Customer**, **Items**, **Payment Summary**, **Shipping
 * Summary**, **Addresses** and **Tags**. Payments and Shipping have their full detail on their own
 * tabs; the statuses, date and customer are also in the page's header.
 */
export function OrderOverviewPanel({ order, preview }: OverviewProps) {
  const source = order ?? preview
  const currency = source?.currency
  const money = (value: string | null | undefined) =>
    value === null || value === undefined || value === ''
      ? null
      : formatPrice(value, currency)
  const customer = order ? orderCustomer(order) : null
  const customerPage = order ? customerPath(order) : null
  // The order's own email is only worth a row of its own when it is not the customer's.
  const orderEmail =
    order?.email &&
    order.email.trim().toLowerCase() !==
      (order.customer?.email ?? '').trim().toLowerCase()
      ? order.email
      : null

  // Nothing known yet (opened from a bare address): a placeholder, not a summary of dashes.
  if (!source) return <DetailSkeleton />

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <MiniCard title="Order Summary" icon={DollarSignIcon}>
        <Rows>
          <Row label="Shopify ID">
            <span className="flex items-center justify-end gap-1.5 font-mono text-[0.76rem] break-all">
              {String(source.shopify_id)}
              <CopyButton value={String(source.shopify_id)} label="Copy Shopify ID" />
            </span>
          </Row>
          <Row label="Total items">
            {source.items_count > 0 ? source.items_count.toLocaleString('en-GB') : null}
          </Row>
          <Row label="Subtotal">{money(source.subtotal_price)}</Row>
          <Row label="Discounts">{money(source.total_discounts)}</Row>
          <Row label="Shipping">{money(source.total_shipping)}</Row>
          <Row label={order?.taxes_included ? 'Tax (included)' : 'Tax'}>
            {money(source.total_tax)}
          </Row>
          <Row label="Total price" strong>
            {money(source.total_price)}
          </Row>
          <Row label="Refunded">{money(source.total_refunded)}</Row>
          <Row label="Net payment">{money(source.net_payment)}</Row>
          {order?.total_outstanding && (
            <Row label="Outstanding">{money(order.total_outstanding)}</Row>
          )}
          {order?.total_tip && Number(order.total_tip) > 0 && (
            <Row label="Tip">{money(order.total_tip)}</Row>
          )}
        </Rows>
      </MiniCard>

      {!order ? (
        <DetailSkeleton />
      ) : (
        <MiniCard title="Customer" icon={UsersIcon}>
          <Rows>
            <Row label="Name">
              {customer &&
                (customerPage ? (
                  <Link
                    to={customerPage}
                    className="text-accent font-semibold hover:underline"
                  >
                    {customer.name}
                  </Link>
                ) : (
                  customer.name
                ))}
            </Row>
            <Row label="Email">
              {order.customer?.email && (
                <span className="flex items-center justify-end gap-1.5">
                  {order.customer.email}
                  <CopyButton value={order.customer.email} label="Copy email" />
                </span>
              )}
            </Row>
            <Row label="Phone">{order.customer?.phone ?? order.phone}</Row>
            {orderEmail && (
              <Row label="Order email">
                <span className="flex items-center justify-end gap-1.5">
                  {orderEmail}
                  <CopyButton value={orderEmail} label="Copy order email" />
                </span>
              </Row>
            )}
            <Row label="Customer’s orders">
              {order.customer?.orders_count?.toLocaleString('en-GB')}
            </Row>
          </Rows>
        </MiniCard>
      )}

      {order && (
        <>
          <div className="lg:col-span-2">
            <OrderItemsSummary order={order} />
          </div>
          <PaymentSummary order={order} />
          <ShippingSummary order={order} />
          <div className="lg:col-span-2">
            <OrderAddresses order={order} />
          </div>
          {order.tags.length > 0 && (
            <div className="lg:col-span-2">
              <MiniCard title="Tags" count={order.tags.length} icon={TagIcon}>
                <Chips items={order.tags} />
              </MiniCard>
            </div>
          )}
        </>
      )}
    </div>
  )
}
