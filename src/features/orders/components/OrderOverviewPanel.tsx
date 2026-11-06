import { Link } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge.tsx'
import { CopyButton } from '../../../components/ui/CopyButton.tsx'
import { DetailSkeleton } from '../../../components/ui/DetailSection.tsx'
import { OrdersIcon, TagIcon, UsersIcon } from '../../../components/ui/icons.tsx'
import type { OrderDetail, OrderListItem } from '../../../lib/api/endpoints.ts'
import type { OrderSavedHandler } from '../hooks/useOrderEdit.ts'
import { formatPrice } from '../../../lib/format.ts'
import { safeUrl } from '../../../lib/safeUrl.ts'
import {
  customerPath,
  fulfillmentTone,
  humanize,
  orderCustomer,
} from '../utils/format.ts'
import { itemsToShip, orderTracking } from '../utils/tracking.ts'
import { OrderAddresses } from './OrderAddressCards.tsx'
import { Chips, MiniCard, Row, Rows } from './OrderCompact.tsx'
import {
  EditableOrderItems,
  OrderDeliveryCostCell,
  OrderDeliveryMethodCell,
  OrderEmailCell,
  type OrderEditContext,
} from './OrderInlineEdits.tsx'
import { OrderItemsSummary } from './OrderItemsPanel.tsx'

interface OverviewProps {
  order: OrderDetail | null
  /** The matching list row, so the cards can draw before the details arrive. */
  preview: OrderListItem | null
  /** The order number from the address, what the update is sent to. */
  reference: string
  shop: string | null
  /** A change was accepted (the order is read again from the API). */
  onSaved: OrderSavedHandler
}

/** An id in small fixed-width type, with a copy button. */
function CopyableId({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex items-center justify-end gap-1.5 font-mono text-[0.76rem] break-all">
      {value}
      <CopyButton value={value} label={label} />
    </span>
  )
}

/** The Overview's **Shipping Summary**: how it goes out, what was charged, and the tracking. */
function ShippingSummary({ context }: { context: OrderEditContext }) {
  const { order } = context
  const { tracking } = orderTracking(order)
  const methods = order.shipping_lines.map((line) => line.title).filter(Boolean)
  const toShip = itemsToShip(order)
  return (
    <MiniCard title="Shipping Summary" icon={OrdersIcon}>
      <Rows>
        <Row label="Delivery method">
          <OrderDeliveryMethodCell
            context={context}
            display={methods.length > 0 ? methods.join(', ') : '—'}
          />
        </Row>
        <Row label="Shipping charged">
          <OrderDeliveryCostCell
            context={context}
            display={
              order.total_shipping === null || order.total_shipping === undefined
                ? '—'
                : formatPrice(order.total_shipping, order.currency)
            }
          />
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
 * The Overview: **Customer**, **Shipping address** and **Billing address** side by side as three
 * cards of one size (the two addresses fold away), then **Items** — a line per product with the
 * order's totals at its foot — **Shipping Summary** and **Tags**. The customer and the totals draw
 * from the list row while the details load; how it was paid is in the page's header. What the
 * update API takes is edited in place, as on a product's page: the email, delivery method and
 * cost by double-clicking them (or their small pencil), the shipping address and the items with
 * the card's pencil, then ✓ Save or ✕ Discard.
 */
export function OrderOverviewPanel({
  order,
  preview,
  reference,
  shop,
  onSaved,
}: OverviewProps) {
  const source = order ?? preview
  const context: OrderEditContext | null = order
    ? { order, reference, shop, onSaved }
    : null

  // Nothing known yet (opened from a bare address): a placeholder, not cards of dashes.
  if (!source) return <DetailSkeleton />

  const customer = orderCustomer(source)
  const customerPage = customerPath(source)
  const customerShopifyId = source.customer?.shopify_id
  // The order's own email is only worth a row of its own when it is not the customer's.
  const orderEmail =
    source.email &&
    source.email.trim().toLowerCase() !==
      (source.customer?.email ?? '').trim().toLowerCase()
      ? source.email
      : null

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-3">
        <MiniCard title="Customer" icon={UsersIcon}>
          <Rows>
            <Row label="Name">
              {customer &&
                (customerPage ? (
                  <Link
                    to={customerPage}
                    state={{ linkedName: customer.name }}
                    className="text-accent font-semibold hover:underline"
                  >
                    {customer.name}
                  </Link>
                ) : (
                  customer.name
                ))}
            </Row>
            {customerShopifyId != null && (
              <Row label="Customer Shopify ID">
                <CopyableId
                  value={String(customerShopifyId)}
                  label="Copy customer Shopify ID"
                />
              </Row>
            )}
            <Row label="Email">
              {context && !orderEmail ? (
                <span className="flex items-center justify-end gap-1.5 break-all">
                  <OrderEmailCell
                    context={context}
                    display={source.customer?.email || source.email || '—'}
                  />
                  {source.customer?.email && (
                    <CopyButton value={source.customer.email} label="Copy email" />
                  )}
                </span>
              ) : (
                source.customer?.email && (
                  <span className="flex items-center justify-end gap-1.5 break-all">
                    {source.customer.email}
                    <CopyButton value={source.customer.email} label="Copy email" />
                  </span>
                )
              )}
            </Row>
            <Row label="Phone">{source.customer?.phone ?? order?.phone}</Row>
            {orderEmail && (
              <Row label="Order email">
                <span className="flex items-center justify-end gap-1.5 break-all">
                  {context ? (
                    <OrderEmailCell context={context} display={orderEmail} />
                  ) : (
                    orderEmail
                  )}
                  <CopyButton value={orderEmail} label="Copy order email" />
                </span>
              </Row>
            )}
            <Row label="Customer’s orders">
              {source.customer?.orders_count?.toLocaleString('en-GB')}
            </Row>
            <Row label="Order Shopify ID">
              {source.shopify_id != null && (
                <CopyableId
                  value={String(source.shopify_id)}
                  label="Copy order Shopify ID"
                />
              )}
            </Row>
          </Rows>
        </MiniCard>

        {context ? (
          <OrderAddresses context={context} />
        ) : (
          <>
            <DetailSkeleton />
            <DetailSkeleton />
          </>
        )}
      </div>

      {context ? (
        <EditableOrderItems context={context} />
      ) : (
        <OrderItemsSummary items={null} totals={source} />
      )}

      {context && order && (
        <>
          <ShippingSummary context={context} />
          {order.tags.length > 0 && (
            <MiniCard title="Tags" count={order.tags.length} icon={TagIcon}>
              <Chips items={order.tags} />
            </MiniCard>
          )}
        </>
      )}
    </div>
  )
}
